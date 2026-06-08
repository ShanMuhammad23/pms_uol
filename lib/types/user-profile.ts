export interface UserProfile {
  employeeId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  department: string | null;
  designation: string | null;
  mobileNumber: string | null;
  employmentStatus: string;
  systemRole: string;
  empCategory: string;
}
