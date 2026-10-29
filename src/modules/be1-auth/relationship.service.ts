// src/modules/be1-auth/relationship.service.ts
import { PrismaClient, RelationType, Status } from '@prisma/client';

const prisma = new PrismaClient();

export class RelationshipService {
  // 1. 가족/담당자 연결 요청 생성 (기본 PENDING 상태)
  async linkUser(patientIdentifier: string, linkedIdentifier: string, relationType: 'FAMILY' | 'STAFF') {
    const patient = await prisma.user.findUnique({
      where: { identifier: patientIdentifier },
    });
    const linkedUser = await prisma.user.findUnique({
      where: { identifier: linkedIdentifier },
    });

    if (!patient || !linkedUser) {
      throw new Error('USER_NOT_FOUND');
    }

    // 중복 연결 체크
    const existing = await prisma.patientRelation.findFirst({
      where: {
        patientIdentifier: patient.identifier,
        linkedIdentifier: linkedUser.identifier,
      },
    });

    if (existing) {
      throw new Error('RELATION_ALREADY_EXISTS');
    }

    // PENDING 상태로 연결 요청 생성
    const newRelation = await prisma.patientRelation.create({
      data: {
        patientIdentifier: patient.identifier,
        linkedIdentifier: linkedUser.identifier,
        relationType: relationType as RelationType,
        status: Status.PENDING, // 대기 상태로 시작
      },
    });

    return {
      success: true,
      data: {
        patientIdentifier: newRelation.patientIdentifier,
        linkedIdentifier: newRelation.linkedIdentifier,
        relationType: newRelation.relationType,
        status: newRelation.status,
      },
      message: `${relationType} connection request sent. Awaiting patient approval.`,
    };
  }

  // 2. 환자가 연결 요청을 허용(승인) 처리
  async approveRelation(patientIdentifier: string, linkedIdentifier: string) {
    const relation = await prisma.patientRelation.findFirst({
      where: {
        patientIdentifier,
        linkedIdentifier,
      },
    });

    if (!relation) {
      throw new Error('RELATION_NOT_FOUND');
    }

    const updated = await prisma.patientRelation.update({
      where: { id: relation.id },
      data: { status: Status.APPROVED },
    });

    return {
      success: true,
      data: {
        patientIdentifier: updated.patientIdentifier,
        linkedIdentifier: updated.linkedIdentifier,
        status: updated.status,
      },
      message: 'Relationship connection approved successfully.',
    };
  }

  // 3. 특정 환자에 연결된 관계 목록 조회 (승인된 항목 또는 전체 조회)
  async getRelationsByPatient(patientIdentifier: string) {
    const patient = await prisma.user.findUnique({
      where: { identifier: patientIdentifier },
    });

    if (!patient) {
      throw new Error('PATIENT_NOT_FOUND');
    }

    const relations = await prisma.patientRelation.findMany({
      where: { patientIdentifier: patient.identifier },
    });

    return relations.map((r) => ({
      patientIdentifier: r.patientIdentifier,
      linkedIdentifier: r.linkedIdentifier,
      relationType: r.relationType,
      status: r.status,
    }));
  }

  // 4. 관계 해제 (해제 즉시 접근 차단)
  async unlinkUser(patientIdentifier: string, linkedIdentifier: string) {
    const relation = await prisma.patientRelation.findFirst({
      where: {
        patientIdentifier,
        linkedIdentifier,
      },
    });

    if (!relation) {
      throw new Error('RELATION_NOT_FOUND');
    }

    await prisma.patientRelation.delete({
      where: { id: relation.id },
    });

    return {
      success: true,
      message: 'Relationship successfully unlinked and access blocked.',
    };
  }

  // 5. 전체 연결 현황 조회 (관리자용)
  async getAllRelations() {
    const relations = await prisma.patientRelation.findMany();

    return relations.map((r) => ({
      patientIdentifier: r.patientIdentifier,
      linkedIdentifier: r.linkedIdentifier,
      relationType: r.relationType,
      status: r.status,
    }));
  }

  // 6. 특정 상담사가 해당 대상자의 승인된 담당자인지 검증 (BE2 연동용)
  async verifyStaffAssignment(staffIdentifier: string, patientIdentifier: string): Promise<boolean> {
    const relation = await prisma.patientRelation.findFirst({
      where: {
        patientIdentifier: patientIdentifier,
        linkedIdentifier: staffIdentifier,
        relationType: RelationType.STAFF,
        status: Status.APPROVED,
      },
    });

    return !!relation; // 승인된 담당 관계가 존재하면 true, 아니면 false
  }
}

export const relationshipService = new RelationshipService();