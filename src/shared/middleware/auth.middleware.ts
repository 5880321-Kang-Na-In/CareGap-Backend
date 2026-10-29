import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Role, Status } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Supabase 환경 변수 (없어도 앱이 죽지 않도록 안전하게 처리)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    identifier: string;
    name: string;
    role: Role;
    status: Status;
  };
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. 헤더에서 토큰 또는 x-user-identifier 추출
    const identifierHeader = req.headers['x-user-identifier'] as string;
    const authHeader = req.headers.authorization;

    let targetIdentifier = identifierHeader;

    if (!targetIdentifier && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      // 만약 Supabase 설정이 되어 있고, 토큰이 진짜 JWT 형식(예: 점 . 이 포함된 긴 문자열)인 경우 Supabase 검증 시도
      if (hasSupabaseConfig && supabase && token.includes('.')) {
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
        if (!error && supabaseUser) {
          // Supabase 유저와 매핑된 DB 유저 탐색
          const dbUser = await prisma.user.findFirst({
            where: { OR: [{ identifier: supabaseUser.email }, { identifier: supabaseUser.id }] },
          });
          if (dbUser) targetIdentifier = dbUser.identifier;
        }
      }

      // Supabase 설정이 없거나 위 검증을 거치지 않았다면 토큰 자체를 identifier(예: 'patient_test_01')로 간주
      if (!targetIdentifier) {
        targetIdentifier = token;
      }
    }

    if (!targetIdentifier) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: '인증 정보(토큰 또는 identifier)가 필요합니다.' },
      });
      return;
    }

    // DB에서 사용자 조회
    const user = await prisma.user.findUnique({
      where: { identifier: targetIdentifier },
    });

    if (!user) {
      res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: '사용자 정보를 찾을 수 없습니다.' },
      });
      return;
    }

    if (user.status === Status.WITHDRAWN) {
      res.status(403).json({
        error: { code: 'ACCOUNT_WITHDRAWN', message: '탈퇴 처리된 계정입니다.' },
      });
      return;
    }

    req.user = {
      identifier: user.identifier,
      name: user.name,
      role: user.role,
      status: user.status,
    };

    next();
  } catch (error) {
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: '인증 처리 중 오류가 발생했습니다.' },
    });
  }
};

export const requireApprovedUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 정보가 없습니다.' } });
    return;
  }
  if (req.user.status !== Status.APPROVED && req.user.status !== Status.ACTIVE) {
    res.status(403).json({
      error: { code: 'NOT_APPROVED', message: '승인 대기 중이거나 이용이 제한된 계정입니다.' },
      status: req.user.status,
    });
    return;
  }
  next();
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 정보가 없습니다.' } });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } });
      return;
    }
    next();
  };
};