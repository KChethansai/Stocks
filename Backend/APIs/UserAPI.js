import exp from 'express'
import { hash, compare } from 'bcryptjs'
import { verifyToken } from '../middlewares/verifyToken.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { upload, allowedImageTypes } from '../config/multer.js'
import { uploadToCloudinary } from '../config/uploadToCloudinary.js'
import cloudinary from '../config/cloudinary.js'
import { env, isProduction, getCookieOptions, getProfileImage } from '../config/env.js'
import { authLimiter } from '../config/security.js'
import { signToken } from '../config/jwt.js'
import { SYMBOL_PATTERN } from '../services/tradeService.js'

export const userApp = exp.Router()

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const profileImageFields = 'profileImage username email balance'

// Sniff real file signatures — never trust the client-supplied MIME type.
const hasValidImageSignature = (buf) => {
  if (!buf || !buf.length) return false
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true // JPEG
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buf.length >= PNG.length && PNG.every((b, i) => buf[i] === b)) return true // PNG
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return true // WebP
  return false
}

const validateProfileImage = (file) => {
  return (
    file &&
    allowedImageTypes.includes(file.mimetype) &&
    file.size <= 5 * 1024 * 1024 &&
    hasValidImageSignature(file.buffer)
  )
}

const isImageStorageConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  )
}

const removeCloudinaryImage = async (publicId) => {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch {
    return
  }
}

const uploadProfileImage = async (req, res, next) => {
  let uploadedImage = null
  try {
    if (!validateProfileImage(req.file)) {
      return res.status(400).json({ message: 'Valid profile image is required' })
    }

    //fetch user
    const foundUser = await userModel.findById(req.user.id)
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!isImageStorageConfigured()) {
      return res.status(503).json({ message: 'Cloudinary is not configured' })
    }

    const previousImage = getProfileImage(foundUser)
    uploadedImage = await uploadToCloudinary(req.file.buffer)

    foundUser.profileImage = {
      publicId: uploadedImage.public_id,
      secureUrl: uploadedImage.secure_url
    }
    await foundUser.save()

    await removeCloudinaryImage(previousImage.publicId)

    return res.status(200).json({
      message: 'Profile picture updated',
      profileImage: getProfileImage(foundUser)
    })
  } catch (err) {
    if (uploadedImage?.public_id) {
      await removeCloudinaryImage(uploadedImage.public_id)
    }
    next(err)
  }
}

const getProfilePicture = async (req, res, next) => {
  try {
    //fetch profile image
    const foundUser = await userModel.findById(req.user.id).select(profileImageFields)
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(200).json({
      message: 'Profile picture fetched',
      profileImage: getProfileImage(foundUser)
    })
  } catch (err) {
    next(err)
  }
}

const removeProfilePicture = async (req, res, next) => {
  try {
    //fetch user
    const foundUser = await userModel.findById(req.user.id)
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const previousImage = getProfileImage(foundUser)
    foundUser.profileImage = { publicId: '', secureUrl: '' }
    await foundUser.save()

    await removeCloudinaryImage(previousImage.publicId)

    return res.status(200).json({
      message: 'Profile picture removed',
      profileImage: getProfileImage(foundUser)
    })
  } catch (err) {
    next(err)
  }
}

userApp
  .route('/profile-picture')
  .get(verifyToken('USER'), getProfilePicture)
  .post(verifyToken('USER'), upload.single('profileImage'), uploadProfileImage)
  .put(verifyToken('USER'), upload.single('profileImage'), uploadProfileImage)
  .delete(verifyToken('USER'), removeProfilePicture)

//register user
userApp.post('/register', upload.single('profileImage'), async (req, res, next) => {
  let uploadedImage = null
  try {
    const { username, email, password } = req.body
    const normalizedUsername = username?.trim()
    const normalizedEmail = email?.toLowerCase()?.trim()

    //validate registration input
    if (
      !normalizedUsername ||
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30 ||
      !emailPattern.test(normalizedEmail || '') ||
      typeof password !== 'string' ||
      password.length < 6 ||
      password.length > 72
    ) {
      return res.status(400).json({ message: 'Invalid registration details' })
    }

    //check if user exists
    const existingUser = await userModel.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    if (req.file && !validateProfileImage(req.file)) {
      return res.status(400).json({ message: 'Valid profile image is required' })
    }

    if (req.file) {
      if (!isImageStorageConfigured()) {
        return res.status(503).json({ message: 'Cloudinary is not configured' })
      }
      uploadedImage = await uploadToCloudinary(req.file.buffer)
    }

    //hash password
    const hashedPassword = await hash(password, 10)
    
    //create user
    const createdUser = await userModel.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      profileImage: uploadedImage
        ? {
            publicId: uploadedImage.public_id,
            secureUrl: uploadedImage.secure_url
          }
        : undefined
    })

    //create initial empty portfolio
    await portfolioModel.create({ userId: createdUser._id, holdings: [] })

    return res.status(201).json({ message: 'Registration successful' })
  } catch (err) {
    if (uploadedImage?.public_id) {
      await removeCloudinaryImage(uploadedImage.public_id)
    }
    next(err)
  }
})

//login user
userApp.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = email?.toLowerCase()?.trim()

    //validate login input
    if (!emailPattern.test(normalizedEmail || '') || typeof password !== 'string') {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    //find user
    const foundUser = await userModel.findOne({ email: normalizedEmail })
    if (!foundUser) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    //verify password
    const isPasswordMatched = await compare(password, foundUser.password)
    if (!isPasswordMatched) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    //generate token
    const token = signToken(foundUser)

    //set token in cookie
    res.cookie('token', token, getCookieOptions())

    return res.status(200).json({
      message: 'Login successful',
      user: {
        _id: foundUser._id,
        username: foundUser.username,
        email: foundUser.email,
        balance: foundUser.balance,
        role: 'USER',
        profileImage: getProfileImage(foundUser),
        watchlist: foundUser.watchlist || []
      }
    })
  } catch (err) {
    next(err)
  }
})

//logout user
userApp.post('/logout', async (req, res, next) => {
  try {
    //clear cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax'
    })
    return res.status(200).json({ message: 'Logout successful' })
  } catch (err) {
    next(err)
  }
})

//get profile
userApp.get('/profile', verifyToken('USER'), async (req, res, next) => {
  try {
    //fetch user
    const foundUser = await userModel.findById(req.user.id).select('-password')
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(200).json({
      message: 'Profile fetched',
      user: { ...foundUser.toObject(), role: 'USER', watchlist: foundUser.watchlist || [] }
    })
  } catch (err) {
    next(err)
  }
})

//update profile details
userApp.put('/profile', verifyToken('USER'), async (req, res, next) => {
  try {
    const { username, email } = req.body
    const normalizedUsername = username?.trim()
    const normalizedEmail = email?.toLowerCase()?.trim()

    //validate profile input
    if (
      !normalizedUsername ||
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30 ||
      !emailPattern.test(normalizedEmail || '')
    ) {
      return res.status(400).json({ message: 'Invalid profile details' })
    }

    //check duplicate profile data
    const existingUser = await userModel.findOne({
      _id: { $ne: req.user.id },
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    })
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' })
    }

    //update user
    const updatedUser = await userModel
      .findByIdAndUpdate(
        req.user.id,
        { username: normalizedUsername, email: normalizedEmail },
        { new: true, runValidators: true }
      )
      .select('-password')
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(200).json({
      message: 'Profile updated',
      user: { ...updatedUser.toObject(), role: 'USER' }
    })
  } catch (err) {
    next(err)
  }
})

//update password
userApp.put('/password', verifyToken('USER'), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    //validate password input
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 6 ||
      newPassword.length > 72
    ) {
      return res.status(400).json({ message: 'Invalid password details' })
    }

    //fetch user
    const foundUser = await userModel.findById(req.user.id)
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    //verify password
    const isPasswordMatched = await compare(currentPassword, foundUser.password)
    if (!isPasswordMatched) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    //hash password
    foundUser.password = await hash(newPassword, 10)
    await foundUser.save()

    return res.status(200).json({ message: 'Password updated' })
  } catch (err) {
    next(err)
  }
})

//get watchlist
userApp.get('/watchlist', verifyToken('USER'), async (req, res, next) => {
  try {
    const foundUser = await userModel.findById(req.user.id).select('watchlist')
    if (!foundUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    return res.status(200).json({ message: 'Watchlist fetched', watchlist: foundUser.watchlist || [] })
  } catch (err) {
    next(err)
  }
})

//add to watchlist
userApp.post('/watchlist', verifyToken('USER'), async (req, res, next) => {
  try {
    const { symbol } = req.body
    if (typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol.trim().toUpperCase())) {
      return res.status(400).json({ message: 'Valid symbol is required' })
    }

    const normalizedSymbol = symbol.trim().toUpperCase()
    const updatedUser = await userModel.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { watchlist: normalizedSymbol } },
      { new: true }
    ).select('watchlist')

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(200).json({ message: 'Added to watchlist', watchlist: updatedUser.watchlist })
  } catch (err) {
    next(err)
  }
})

//remove from watchlist
userApp.delete('/watchlist/:symbol', verifyToken('USER'), async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.trim().toUpperCase()
    if (!SYMBOL_PATTERN.test(symbol || '')) {
      return res.status(400).json({ message: 'Valid symbol is required' })
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      req.user.id,
      { $pull: { watchlist: symbol } },
      { new: true }
    ).select('watchlist')

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.status(200).json({ message: 'Removed from watchlist', watchlist: updatedUser.watchlist })
  } catch (err) {
    next(err)
  }
})

