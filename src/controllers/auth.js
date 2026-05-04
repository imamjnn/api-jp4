import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {eq} from 'drizzle-orm';
import {db} from '../db';
import {users, userCredentials, sessions} from '../db/schema';

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return {accessToken, refreshToken};
};

export const login = async (req, res) => {
  const {email, password} = req.body;

  if (!email || !password) {
    return res.status(400).json({success: false, message: 'Email and password are required'});
  }

  try {
    const [credential] = await db
      .select({
        id: userCredentials.id,
        userId: userCredentials.userId,
        email: userCredentials.email,
        password: userCredentials.password,
        role: userCredentials.role,
        userName: users.name,
      })
      .from(userCredentials)
      .leftJoin(users, eq(userCredentials.userId, users.id))
      .where(eq(userCredentials.email, email));

    if (!credential) {
      return res.status(401).json({success: false, message: 'Invalid email or password'});
    }

    const valid = await bcrypt.compare(password, credential.password);
    if (!valid) {
      return res.status(401).json({success: false, message: 'Invalid email or password'});
    }

    const payload = {userId: credential.userId, role: credential.role};
    const {accessToken, refreshToken} = generateTokens(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(sessions).values({
      userId: credential.userId,
      accessToken,
      refreshToken,
      expiresAt,
    });

    // Update last login info
    await db
      .update(userCredentials)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
        lastLoginUserAgent: req.headers['user-agent'] || null,
      })
      .where(eq(userCredentials.id, credential.id));

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {id: credential.userId, name: credential.userName, role: credential.role},
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({success: false, message: 'Internal server error', error: JSON.stringify(err)});
  }
};

export const refresh = async (req, res) => {
  const {refreshToken} = req.body;

  if (!refreshToken) {
    return res.status(400).json({success: false, message: 'Refresh token required'});
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshToken, refreshToken));

    if (!session) {
      return res.status(401).json({success: false, message: 'Invalid refresh token'});
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, session.id));
      return res.status(401).json({success: false, message: 'Refresh token expired'});
    }

    const newPayload = {userId: payload.userId, role: payload.role};
    const {accessToken, refreshToken: newRefreshToken} = generateTokens(newPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db
      .update(sessions)
      .set({accessToken, refreshToken: newRefreshToken, expiresAt})
      .where(eq(sessions.id, session.id));

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {accessToken, refreshToken: newRefreshToken},
    });
  } catch (err) {
    return res.status(401).json({success: false, message: 'Invalid or expired refresh token'});
  }
};

export const logout = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(400).json({success: false, message: 'Access token required'});
  }

  try {
    await db.delete(sessions).where(eq(sessions.accessToken, token));
    res.json({success: true, message: 'Logged out successfully'});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const me = async (req, res) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: userCredentials.email,
        role: userCredentials.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userCredentials, eq(users.id, userCredentials.userId))
      .where(eq(users.id, req.user.userId));

    if (!user) {
      return res.status(404).json({success: false, message: 'User not found'});
    }

    res.json({success: true, message: 'OK', data: user});
  } catch (err) {
    console.error(err);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
