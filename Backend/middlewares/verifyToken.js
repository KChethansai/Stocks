import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
const { verify } = jwt

export const verifyToken = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      //get token from cookie
      const token = req.cookies?.token
      if (!token)
        return res.status(401).json({ message: 'Please Login first' })
      const decodedToken = verify(token, env.secretKey)
      if (!decodedToken?.id || !decodedToken?.role) {
        return res.status(401).json({ message: 'Invalid token' })
      }
      if (allowedRoles.length > 0 && !allowedRoles.includes(decodedToken.role))
        return res.status(403).json({ message: 'You are not authorized' })
      req.user = decodedToken
      next()
    } catch (err) {
      res.status(401).json({ message: 'Invalid token' })
    }
  }
}
