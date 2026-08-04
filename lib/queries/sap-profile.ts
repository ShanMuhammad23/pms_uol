import "server-only";

export interface SapEmployeeProfile {
  employeeId: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  department: string;
  designation: string;
  mobileNumber: string;
  employmentStatus: string;
}

export class SapProfileError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SapProfileError";
    this.status = status;
  }
}

const SAP_BASE_URL =
  "http://uolerp.uol.edu.pk:8000/sap/opu/odata/sap/Z_EMP_INFO_API_SRV";

const readTag = (xml: string, tag: string): string => {
  const pattern = new RegExp(`<d:${tag}>([\\s\\S]*?)</d:${tag}>`, "i");
  const match = xml.match(pattern);
  return match?.[1]?.trim() ?? "";
};

export async function getSapEmployeeProfile(
  email: string,
): Promise<SapEmployeeProfile> {
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;

  if (!username || !password) {
    throw new Error("SAP_USERNAME or SAP_PASSWORD is not configured.");
  }

  const normalizedEmail = email.trim().toUpperCase();
  const encodedEmail = encodeURIComponent(normalizedEmail);
  const url = `${SAP_BASE_URL}/empinfoSet('${encodedEmail}')`;

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Accept: "application/xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text();

    if (response.status === 404) {
      throw new SapProfileError(
        `No SAP profile was found for ${normalizedEmail}.`,
        response.status,
      );
    }

    const sapMessage =
      readTag(responseBody, "message") ||
      readTag(responseBody, "errordetail") ||
      readTag(responseBody, "value");

    throw new SapProfileError(
      sapMessage || `SAP service returned status ${response.status}.`,
      response.status,
    );
  }

  const xml = await response.text();

  return {
    employeeId: readTag(xml, "EmployeeId"),
    firstName: readTag(xml, "FirstName"),
    lastName: readTag(xml, "LastName"),
    emailAddress: readTag(xml, "EmailAddress"),
    department: readTag(xml, "Department"),
    designation: readTag(xml, "Designation"),
    mobileNumber: readTag(xml, "MobileNumber"),
    employmentStatus: readTag(xml, "EmploymentStatus"),
  };
}
