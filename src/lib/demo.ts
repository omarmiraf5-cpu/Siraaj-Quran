export const DEMO_ACCOUNTS = {
  admin: {
    email: "admin@mydiiwaan.com",
    password: "admin123",
    name: "School Admin",
    role: "admin" as const,
  },
  teacher: {
    email: "teacher@mydiiwaan.com",
    password: "teacher123",
    name: "Ms. Farah",
    role: "teacher" as const,
  },
  parent: {
    email: "parent@mydiiwaan.com",
    password: "parent123",
    name: "Halima Warsame",
    role: "parent" as const,
  },
  student: {
    pin: "1234",
    name: "Omar W.",
    role: "student" as const,
  },
};

export const DEMO_SCHOOL = {
  name: "Siraaj Academy",
  city: "Edmonton",
  province: "AB",
  year: "2026–2027",
};
