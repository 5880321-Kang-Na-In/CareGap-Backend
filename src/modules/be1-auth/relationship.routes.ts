// src/modules/be1-auth/relationship.routes.ts
import { Router } from 'express';
import { relationshipService } from './relationship.service.js';
// 1. 보안 미들웨어 임포트 추가
import { authenticateUser } from '../../shared/middleware/auth.middleware.js';

export function createRelationshipRouter(): Router {
  const router = Router();

  // 환자와 보호자/담당자 연결(링크) 생성 (인증 필요)
  router.post('/link', authenticateUser, async (req, res, next) => {
    try {
      const { patientIdentifier, linkedIdentifier, relationType } = req.body;
      const result = await relationshipService.linkUser(
        patientIdentifier,
        linkedIdentifier,
        relationType
      );
      return res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // ✨ BE2 연동용: 특정 상담사-대상자 관계 권한 검증 API (동적 경로보다 위에 위치해야 함)
  router.get('/verify', authenticateUser, async (req, res, next) => {
    try {
      const { staffIdentifier, patientIdentifier } = req.query;

      if (!staffIdentifier || !patientIdentifier) {
        return res.status(400).json({
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'staffIdentifier와 patientIdentifier는 필수 파라미터입니다.',
          },
        });
      }

      const isAuthorized = await relationshipService.verifyStaffAssignment(
        String(staffIdentifier),
        String(patientIdentifier)
      );

      return res.status(200).json({
        success: true,
        data: {
          isAuthorized,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // 특정 환자에 연결된 관계 목록 조회 (인증 필요)
  router.get('/:patientIdentifier', authenticateUser, async (req, res, next) => {
    try {
      const { patientIdentifier } = req.params;
      const relations = await relationshipService.getRelationsByPatient(patientIdentifier);
      return res.json({ data: relations });
    } catch (error) {
      next(error);
    }
  });

  // 관계 해제 라우터 (인증 필요)
  router.delete('/unlink', authenticateUser, async (req, res, next) => {
    try {
      const { patientIdentifier, linkedIdentifier } = req.body;
      const result = await relationshipService.unlinkUser(patientIdentifier, linkedIdentifier);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // 전체 관계 현황 조회 (관리자용, 인증 필요)
  router.get('/admin/all', authenticateUser, async (_req, res, next) => {
    try {
      const allRelations = await relationshipService.getAllRelations();
      return res.json({ data: allRelations });
    } catch (error) {
      next(error);
    }
  });

  // 환자가 연결 요청을 승인하는 라우터
  router.post('/approve', authenticateUser, async (req, res, next) => {
    try {
      const { patientIdentifier, linkedIdentifier } = req.body;
      const result = await relationshipService.approveRelation(patientIdentifier, linkedIdentifier);
      return res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}