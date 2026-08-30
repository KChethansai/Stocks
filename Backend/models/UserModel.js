import { Schema, model } from 'mongoose'

//user credentials
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is invalid']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    avatarSource: {
      type: String,
      enum: ['google', 'cloudinary'],
      default: 'google'
    },
    balance: {
      type: Number,
      default: 100000,
      min: [0, 'Balance cannot be negative']
    },
    watchlist: {
      type: [String],
      default: []
    },
    profileImage: {
      publicId: {
        type: String,
        default: ''
      },
      secureUrl: {
        type: String,
        default: ''
      }
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

export const userModel = model('user', userSchema)
