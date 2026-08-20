import {
  adminAccountStatusBadgeClass,
  adminAccountStatusLabel,
  adminRoleLabel,
  localizedAdminUserLastExecutionLabel,
  localizedExecutionStateLabel,
  localizedExecutionStateOptions,
} from "./adminExecutionStateModel";

import {
  translate,
} from "../i18n/i18nCore";


const tEn = (key, params) =>
  translate("en", key, params);

const tEs = (key, params) =>
  translate("es", key, params);


describe(
  "admin execution state I18N foundation",
  () => {
    test(
      "localizes canonical execution states without changing filter values",
      () => {
        expect(
          localizedExecutionStateLabel(
            "COMPLETED",
            tEn
          )
        ).toBe("Completed");

        expect(
          localizedExecutionStateLabel(
            "COMPLETED",
            tEs
          )
        ).toBe("Completado");

        const options =
          localizedExecutionStateOptions(
            tEn
          );

        expect(
          options.map(
            (item) => item.value
          )
        ).toEqual([
          "all",
          "QUEUED",
          "RUNNING",
          "PROCESSING",
          "COMPLETED",
          "FAILED",
          "CANCELLED",
        ]);

        expect(
          options.map(
            (item) => item.label
          )
        ).toEqual([
          "All",
          "Queued",
          "Running",
          "Processing",
          "Completed",
          "Failed",
          "Cancelled",
        ]);
      }
    );


    test(
      "localizes roles and account status from technical values",
      () => {
        expect(
          adminRoleLabel(
            "Student",
            tEn
          )
        ).toBe("Student");

        expect(
          adminRoleLabel(
            "Teacher",
            tEs
          )
        ).toBe("Docente");

        expect(
          adminAccountStatusLabel(
            true,
            tEn
          )
        ).toBe("Active");

        expect(
          adminAccountStatusLabel(
            false,
            tEs
          )
        ).toBe("Inactivo");

        expect(
          adminAccountStatusBadgeClass(
            true
          )
        ).toContain("success");

        expect(
          adminAccountStatusBadgeClass(
            false
          )
        ).toContain("warning");
      }
    );


    test(
      "last execution presentation prefers canonical state over legacy Spanish label",
      () => {
        const user = {
          lastExecutionState:
            "COMPLETED",
          lastExecutionStatus:
            "Completado",
        };

        expect(
          localizedAdminUserLastExecutionLabel(
            user,
            tEn
          )
        ).toBe("Completed");

        expect(
          localizedAdminUserLastExecutionLabel(
            {
              lastExecutionState:
                null,
              lastExecutionStatus:
                "Sin ejecuciones",
            },
            tEn
          )
        ).toBe("No executions");
      }
    );
  }
);
