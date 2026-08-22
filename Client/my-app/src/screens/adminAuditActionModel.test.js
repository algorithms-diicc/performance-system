import {
  ADMIN_AUDIT_ACTIONS,
  adminAuditActionLabel,
  adminAuditActionOptions,
} from "./adminAuditActionModel";


const translations = {
  "adminAuditLog.actionLabels.approveAccessRequest":
    "Access request approved",
  "adminAuditLog.actionLabels.transferCourseTeacher":
    "Course responsibility transferred",
  "adminAuditLog.actionLabels.cloneCourse":
    "Course cloned",
  "adminAuditLog.actionLabels.changeUserRole":
    "User role changed",
  "adminAuditLog.actionLabels.unknown":
    "Unknown action",
  "adminAuditLog.fallbacks.action":
    "Action",
};


const t = (key) =>
  translations[key]
  || `translated:${key}`;


describe(
  "adminAuditActionModel",
  () => {
    test(
      "contains exactly the action codes emitted by current static routes",
      () => {
        expect(
          ADMIN_AUDIT_ACTIONS.map(
            ({ code }) => code
          )
        ).toEqual([
          "approve_access_request",
          "reject_access_request",
          "create_course",
          "update_course",
          "transfer_course_teacher",
          "clone_course",
          "add_course_students",
          "remove_course_student",
          "restore_course_student",
          "rerun_submission",
          "change_user_role",
        ]);

        expect(
          adminAuditActionOptions(t)
            .map(
              ({ value }) => value
            )
        ).toEqual(
          ADMIN_AUDIT_ACTIONS.map(
            ({ code }) => code
          )
        );
      }
    );


    test(
      "humanizes known codes and safely handles unknown or missing codes",
      () => {
        expect(
          adminAuditActionLabel(
            "approve_access_request",
            t
          )
        ).toBe(
          "Access request approved"
        );
        expect(
          adminAuditActionLabel(
            "transfer_course_teacher",
            t
          )
        ).toBe(
          "Course responsibility transferred"
        );
        expect(
          adminAuditActionLabel(
            "clone_course",
            t
          )
        ).toBe("Course cloned");
        expect(
          adminAuditActionLabel(
            "change_user_role",
            t
          )
        ).toBe("User role changed");
        expect(
          adminAuditActionLabel(
            "legacy_custom_action",
            t
          )
        ).toBe(
          "Unknown action"
        );
        expect(
          adminAuditActionLabel(
            "",
            t
          )
        ).toBe("Action");
      }
    );
  }
);
