// src/modules/be1-auth/auth.service.ts
import { PrismaClient, Role, Status } from '@prisma/client';

const prisma = new PrismaClient();
export type UserRole = 'PATIENT' | 'FAMILY' | 'STAFF' | 'ADMIN';

export interface RegisterDto {
  role: UserRole;
  identifier: string;
  secret: string;
  name: string;
}

export class AuthService {
  // 로그인 처리 (DB 조회)
  async login(role: string, identifier: string, secret: string) {
    const user = await prisma.user.findUnique({
      where: { identifier },
    });

    if (!user || user.role !== role || user.secret !== secret) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // 탈퇴한 회원인 경우 로그인 차단
    if (user.status === Status.WITHDRAWN) {
      throw new Error('USER_WITHDRAWN');
    }

    // 담당자(STAFF)의 경우 승인 상태 체크 (PENDING 상태인 경우)
    if (user.role === 'STAFF' && user.status === Status.PENDING) {
      return {
        success: false,
        message: 'Staff account is pending approval by admin.',
      };
    }

    return {
      success: true,
      role: user.role,
      identifier: user.identifier,
      name: user.name,
      message: 'Login successful',
    };
  }

  // 회원가입 처리 (DB 생성)
  async register(userData: RegisterDto) {
    // 중복 아이디 체크
    const existing = await prisma.user.findUnique({
      where: { identifier: userData.identifier },
    });

    if (existing) {
      throw new Error('DUPLICATE_IDENTIFIER');
    }

    // 담당자(STAFF)는 기본적으로 승인 대기(PENDING) 상태, 나머지는 ACTIVE 상태
    const initialStatus = userData.role === 'STAFF' ? Status.PENDING : Status.ACTIVE;

    const newUser = await prisma.user.create({
      data: {
        identifier: userData.identifier,
        secret: userData.secret,
        name: userData.name,
        role: userData.role as Role,
        status: initialStatus,
      },
    });

    return {
      success: true,
      role: newUser.role,
      identifier: newUser.identifier,
      status: newUser.status,
      message: userData.role === 'STAFF' 
        ? 'Registration successful. Awaiting admin approval.' 
        : 'Registration successful.',
    };
  }

  // 승인 대기 중인 담당자 목록 조회 (관리자용)
  async getPendingStaffs() {
    const pendingStaffs = await prisma.user.findMany({
      where: {
        role: Role.STAFF,
        status: Status.PENDING,
      },
    });

    return pendingStaffs.map((u) => ({
      role: u.role,
      identifier: u.identifier,
      name: u.name,
      status: u.status,
    }));
  }

  // 예시: approveStaff 함수 내부 수정
  async approveStaff(identifier: string) {
    // 1. 기존 승인 처리 로직...
    const updatedUser = await prisma.user.update({
      where: { identifier },
      data: { status: 'APPROVED' },
    });

    // 2. ✨ 감사 로그 기록 추가!
    await prisma.auditLog.create({
      data: {
        adminId: 'admin_test_01', // 또는 요청을 수행한 관리자의 identifier
        action: 'APPROVE_STAFF',
        target: identifier,
        details: `${identifier} 담당자 계정이 승인되었습니다.`,
      },
    });

    return { success: true, data: updatedUser };
  }

  // 전체 사용자 계정 현황 조회 (관리자용)
  async getAllUsers() {
    const users = await prisma.user.findMany();

    return users.map((u) => ({
      role: u.role,
      identifier: u.identifier,
      name: u.name,
      status: u.status,
    }));
  }

  // 1. 담당자 반려 처리 (관리자용)
  async rejectStaff(identifier: string) {
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user || user.role !== Role.STAFF) {
      throw new Error('STAFF_NOT_FOUND');
    }

    const updatedUser = await prisma.user.update({
      where: { identifier },
      data: { status: Status.REJECTED },
    });

    return {
      success: true,
      identifier: updatedUser.identifier,
      status: updatedUser.status,
      message: 'Staff application rejected.',
    };
  }

  // 2. 반려된 담당자의 자격증 자료 재제출
  async resubmitStaffDocs(identifier: string, newSecret?: string) {
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user || user.role !== Role.STAFF) {
      throw new Error('STAFF_NOT_FOUND');
    }

    const updatedData: any = { status: Status.PENDING };
    if (newSecret) {
      updatedData.secret = newSecret; // 필요시 정보 갱신
    }

    const updatedUser = await prisma.user.update({
      where: { identifier },
      data: updatedData,
    });

    return {
      success: true,
      identifier: updatedUser.identifier,
      status: updatedUser.status,
      message: 'Staff documents resubmitted and status changed to PENDING.',
    };
  }

  // 1. 아이디 찾기 (이름 기반 검색)
  async findIdentifierByName(name: string) {
    const users = await prisma.user.findMany({
      where: { name },
      select: {
        identifier: true,
        role: true,
        createdAt: true,
      },
    });

    if (!users || users.length === 0) {
      throw new Error('USER_NOT_FOUND');
    }

    return {
      success: true,
      users,
      message: 'Matching users found.',
    };
  }

  // 2. 비밀번호(Secret) 재설정
  async resetSecret(identifier: string, newSecret: string) {
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const updatedUser = await prisma.user.update({
      where: { identifier },
      data: { secret: newSecret },
    });

    return {
      success: true,
      identifier: updatedUser.identifier,
      message: 'Password/Secret successfully reset.',
    };
  }

  // 회원탈퇴 처리 (관련 관계 데이터 정리 및 상태 변경 또는 삭제)
  async withdrawUser(identifier: string) {
    const user = await prisma.user.findUnique({
      where: { identifier },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 트랜잭션을 통해 연관된 관계 데이터 정리와 계정 처리를 원자적으로 수행
    await prisma.$transaction(async (tx) => {
      // 1. 해당 유저와 엮여 있는 모든 관계(PatientRelation) 데이터 먼저 삭제
      await tx.patientRelation.deleteMany({
        where: {
          OR: [
            { patientIdentifier: identifier },
            { linkedIdentifier: identifier },
          ],
        },
      });

      // 2. 계정 완전 삭제 (또는 필요시 data: { status: Status.WITHDRAWN }로 소프트 딜리트 적용 가능)
      await tx.user.delete({
        where: { identifier },
      });
    });

    return {
      success: true,
      identifier,
      message: 'User account successfully withdrawn and related data cleaned up.',
    };
  }
}

export const authService = new AuthService();