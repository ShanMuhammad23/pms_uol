export interface UserProfile {
  employeeId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  entity: string | null;
  orgLevel1: string | null;
  orgLevel2: string | null;
  designation: string | null;
  dateOfJoining: string | null;
  qualification: string | null;
  qualificationYear: string | null;
  qualificationSubject: string | null;
  qualificationInstitute: string | null;
  qualificationCountry: string | null;
  mobileNumber: string | null;
  employmentStatus: string;
  systemRole: string;
  empCategory: string;
}
