// JWT signing helper: single source of truth for token payload & lifetime.
import jwt from 'jsonwebtoken'
import { env } from './env.js'

const { sign } = jwt

export const signToken = (user) =>
  sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || 'USER'
    },
    env.secretKey,
    { expiresIn: '7d' }
  )