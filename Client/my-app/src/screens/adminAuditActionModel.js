export const ADMIN_AUDIT_ACTIONS = Object.freeze([
  {
    code: "approve_access_request",
    labelKey:
      "adminAuditLog.actionLabels.approveAccessRequest",
  },
  {
    code: "reject_access_request",
    labelKey:
      "adminAuditLog.actionLabels.rejectAccessRequest",
  },
  {
    code: "create_course",
    labelKey:
      "adminAuditLog.actionLabels.createCourse",
  },
  {
    code: "update_course",
    labelKey:
      "adminAuditLog.actionLabels.updateCourse",
  },
  {
    code: "transfer_course_teacher",
    labelKey:
      "adminAuditLog.actionLabels.transferCourseTeacher",
  },
  {
    code: "clone_course",
    labelKey:
      "adminAuditLog.actionLabels.cloneCourse",
  },
  {
    code: "add_course_students",
    labelKey:
      "adminAuditLog.actionLabels.addCourseStudents",
  },
  {
    code: "remove_course_student",
    labelKey:
      "adminAuditLog.actionLabels.removeCourseStudent",
  },
  {
    code: "restore_course_student",
    labelKey:
      "adminAuditLog.actionLabels.restoreCourseStudent",
  },
  {
    code: "rerun_submission",
    labelKey:
      "adminAuditLog.actionLabels.rerunSubmission",
  },
  {
    code: "create_experimental_protocol",
    labelKey:
      "adminAuditLog.actionLabels.createExperimentalProtocol",
  },
  {
    code: "update_experimental_protocol",
    labelKey:
      "adminAuditLog.actionLabels.updateExperimentalProtocol",
  },
  {
    code: "publish_experimental_protocol",
    labelKey:
      "adminAuditLog.actionLabels.publishExperimentalProtocol",
  },
  {
    code: "deactivate_experimental_protocol",
    labelKey:
      "adminAuditLog.actionLabels.deactivateExperimentalProtocol",
  },
  {
    code: "change_user_role",
    labelKey:
      "adminAuditLog.actionLabels.changeUserRole",
  },
]);


const ACTION_BY_CODE = new Map(
  ADMIN_AUDIT_ACTIONS.map(
    (action) => [
      action.code,
      action,
    ]
  )
);


export function adminAuditActionLabel(
  code,
  t
) {
  const normalized =
    String(code || "").trim();

  if (!normalized) {
    return t(
      "adminAuditLog.fallbacks.action"
    );
  }

  const action =
    ACTION_BY_CODE.get(
      normalized
    );

  return action
    ? t(action.labelKey)
    : t(
        "adminAuditLog.actionLabels.unknown"
      );
}


export function adminAuditActionOptions(
  t
) {
  return ADMIN_AUDIT_ACTIONS.map(
    (action) => ({
      value: action.code,
      label: t(
        action.labelKey
      ),
    })
  );
}
