// src/modules/be1-auth/auth.routes.ts
import { Router } from 'express';
import { authService } from './auth.service.js';
// 1. 보안 미들웨어 임포트 추가
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function createAuthRouter(): Router {
  const router = Router();

  // 로그인 엔드포인트 (인증 불필요)
  router.post('/login', async (req, res, next) => {
    try {
      const { role, identifier, secret } = req.body;
      const result = await authService.login(role, identifier, secret);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 회원가입 엔드포인트 (인증 불필요)
  router.post('/register', async (req, res, next) => {
    try {
      const userData = req.body;
      const result = await authService.register(userData);
      return res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 승인 대기 중인 담당자 목록 조회 엔드포인트 (관리자 등 인증 필요)
  router.get('/staff/pending', authenticateUser, async (_req, res, next) => {
    try {
      const pendingList = await authService.getPendingStaffs();
      return res.json({ data: pendingList });
    } catch (error) {
      next(error);
    }
  });

  // 담당자 승인 처리 엔드포인트 (관리자 등 인증 필요)
  router.post('/staff/approve', authenticateUser, async (req, res, next) => {
    try {
      const { identifier } = req.body;
      const result = await authService.approveStaff(identifier);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 전체 사용자 계정 현황 조회 (관리자용, 인증 필요)
  router.get('/admin/users', authenticateUser, async (_req, res, next) => {
    try {
      const users = await authService.getAllUsers();
      return res.json({ data: users });
    } catch (error) {
      next(error);
    }
  });

  // 담당자 반려 처리 엔드포인트 (관리자용, 인증 필요)
  router.post('/staff/reject', authenticateUser, async (req, res, next) => {
    try {
      const { identifier } = req.body;
      const result = await authService.rejectStaff(identifier);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 반려된 담당자의 자격증 자료 재제출 엔드포인트 (인증 필요)
  router.post('/staff/resubmit', authenticateUser, async (req, res, next) => {
    try {
      const { identifier, newSecret } = req.body;
      const result = await authService.resubmitStaffDocs(identifier, newSecret);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 아이디 찾기 엔드포인트
  router.post('/find-id', async (req, res, next) => {
    try {
      const { name } = req.body;
      const result = await authService.findIdentifierByName(name);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 비밀번호 재설정 엔드포인트
  router.post('/reset-secret', async (req, res, next) => {
    try {
      const { identifier, newSecret } = req.body;
      const result = await authService.resetSecret(identifier, newSecret);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 회원탈퇴 API (본인 인증 필요)
  router.delete('/withdraw', authenticateUser, async (req, res, next) => {
    try {
      const { identifier } = req.body;
      const result = await authService.withdrawUser(identifier);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 🛡️ 관리자 감사 로그 조회 엔드포인트 (인증 필요)
  router.get('/admin/audit-logs', authenticateUser, async (_req, res, next) => {
    try {
      // Prisma를 직접 사용하여 AuditLog 테이블 조회
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' }, // 최신순 정렬
      });
      return res.json({ data: logs });
    } catch (error) {
      next(error);
    }
  });

  return router;
}