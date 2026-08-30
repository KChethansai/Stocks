import { OAuth2Client } from 'google-auth-library'
import { hash } from 'bcryptjs'
import crypto from 'crypto'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { env, getCookieOptions, getProfileImage } from '../config/env.js'
import { signToken } from '../config/jwt.js'

const client = new OAuth2Client(env.googleClientId)

export const googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' })
    }

    // Verify token signature & audience
    let ticket
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: env.googleClientId
      })
    } catch (err) {
      console.error('Google token verification failed:', err.message)
      return res.status(401).json({ message: 'Google authentication failed. Invalid token.' })
    }

    const payload = ticket.getPayload()
    if (!payload) {
      return res.status(401).json({ message: 'Google authentication failed. No payload.' })
    }

    const { sub: googleId, email, name, picture, email_verified } = payload

    // Verify email is verified
    if (email_verified !== true) {
      return res.status(401).json({ message: 'Google authentication failed. Email not verified by Google.' })
    }

    const normalizedEmail = email?.toLowerCase()?.trim()

    // 1. Find user by googleId
    let foundUser = await userModel.findOne({ googleId })

    if (foundUser) {
      // User exists, check/update fields if necessary
      let changed = false
      if (foundUser.provider !== 'google') {
        foundUser.provider = 'google'
        changed = true
      }
      if (changed) {
        await foundUser.save()
      }
    } else {
      // 2. Find user by email (existing local user)
      foundUser = await userModel.findOne({ email: normalizedEmail })

      if (foundUser) {
        // Link Google ID
        foundUser.googleId = googleId
        foundUser.provider = 'google'
        if (picture && (!foundUser.profileImage || !foundUser.profileImage.secureUrl)) {
          foundUser.profileImage = {
            publicId: '',
            secureUrl: picture
          }
          foundUser.avatarSource = 'google'
        }
        await foundUser.save()
      } else {
        // 3. Create new user
        // Generate a unique username based on Google display name or email prefix
        let baseUsername = name ? name.replace(/\s+/g, '').toLowerCase() : normalizedEmail.split('@')[0]
        baseUsername = baseUsername.replace(/[^a-zA-Z0-9]/g, '') // strip special chars
        if (baseUsername.length < 3) baseUsername = 'user_' + baseUsername
        if (baseUsername.length > 25) baseUsername = baseUsername.substring(0, 25)

        let username = baseUsername
        let suffix = 1
        // Ensure username uniqueness
        while (await userModel.findOne({ username })) {
          username = `${baseUsername}${suffix}`
          suffix++
        }

        // Generate a random secure password for schema validation
        const randomPassword = crypto.randomBytes(32).toString('hex')
        const hashedPassword = await hash(randomPassword, 10)

        // Create new user record
        foundUser = await userModel.create({
          username,
          email: normalizedEmail,
          password: hashedPassword,
          googleId,
          provider: 'google',
          avatarSource: 'google',
          profileImage: picture
            ? {
                publicId: '',
                secureUrl: picture
              }
            : undefined
        })

        // Immediately create portfolio for new user
        await portfolioModel.create({ userId: foundUser._id, holdings: [] })
      }
    }

    // Generate JWT token
    const token = signToken(foundUser)

    // Set token in cookie
    res.cookie('token', token, getCookieOptions())

    // Return response
    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      user: {
        _id: foundUser._id,
        username: foundUser.username,
        email: foundUser.email,
        balance: foundUser.balance,
        role: 'USER',
        profileImage: getProfileImage(foundUser),
        watchlist: foundUser.watchlist || []
      },
      token
    })
  } catch (err) {
    console.error('Google auth handler error:', err)
    next(err)
  }
}
