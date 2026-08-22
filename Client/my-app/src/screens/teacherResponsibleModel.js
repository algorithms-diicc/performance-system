import {
  teacherApi,
} from "./teacherApi";


const RESPONSIBLE_ROLES = [
  "Teacher",
  "Admin",
];


function normalizeCandidate(user) {
  const id = Number(user?.id);

  if (
    !Number.isFinite(id)
    || user?.isActive !== true
    || !RESPONSIBLE_ROLES.includes(
      String(user?.role || "")
    )
  ) {
    return null;
  }

  return {
    id,
    fullName:
      String(
        user?.name
        || user?.fullName
        || ""
      ).trim(),
    email:
      String(user?.email || "")
        .trim(),
    role: user.role,
  };
}


export async function loadResponsibleCandidates(
  signal
) {
  const payloads =
    await Promise.all(
      RESPONSIBLE_ROLES.map(
        (role) => {
          const params =
            new URLSearchParams({
              role,
              status: "active",
              sort_by: "name",
              sort_dir: "asc",
              page_size: "10000",
            });

          return teacherApi(
            `/api/admin/users?${params.toString()}`,
            { signal }
          );
        }
      )
    );

  const byId = new Map();

  payloads.forEach(
    (payload) => {
      const items =
        Array.isArray(payload?.items)
          ? payload.items
          : [];

      items.forEach(
        (item) => {
          const candidate =
            normalizeCandidate(item);

          if (candidate) {
            byId.set(
              candidate.id,
              candidate
            );
          }
        }
      );
    }
  );

  return Array.from(
    byId.values()
  ).sort(
    (left, right) =>
      (
        left.fullName
        || left.email
      ).localeCompare(
        right.fullName
        || right.email
      )
  );
}


export function includeCurrentResponsible(
  candidates,
  current
) {
  const currentId =
    Number(current?.id);

  if (!Number.isFinite(currentId)) {
    return candidates;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.id === currentId
    )
  ) {
    return candidates;
  }

  return [
    {
      id: currentId,
      fullName:
        String(
          current?.fullName || ""
        ).trim(),
      email:
        String(
          current?.email || ""
        ).trim(),
      role: "",
      isCurrent: true,
    },
    ...candidates,
  ];
}


export function responsibleOptionLabel(
  candidate
) {
  const name =
    String(
      candidate?.fullName || ""
    ).trim();
  const email =
    String(
      candidate?.email || ""
    ).trim();

  if (name && email) {
    return `${name} — ${email}`;
  }

  return name || email || `#${candidate?.id}`;
}
