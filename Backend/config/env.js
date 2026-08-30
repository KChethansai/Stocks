// env config: validates deployment-time backend configuration.
import { config } from 'dotenv'

import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '../.env') })

const requiredVars = ['DB_URL', 'SECRET_KEY']

const missingVars = requiredVars.filter((key) => !process.env[key])

if (missingVars.length > 0) {
  throw new Error(`Missing required env vars: ${missingVars.join(', ')}`)
}

const parseBoolean = (value) =>
  typeof value === 'string' && /^(true|1|yes|y|ssl|tls)$/i.test(value.trim())

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  dbUrl: process.env.DB_URL,
  secretKey: process.env.SECRET_KEY,
  clientUrls: (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  cookieSameSite:
    process.env.COOKIE_SAME_SITE ||
    (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || ''
}

export const isProduction = env.nodeEnv === 'production'

export const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: env.cookieSameSite,
  secure: isProduction || env.cookieSameSite === 'none',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
})

export const getProfileImage = (user) => ({
  publicId: user?.profileImage?.publicId || '',
  secureUrl: user?.profileImage?.secureUrl || ''
})
