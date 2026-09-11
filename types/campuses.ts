export interface CampusRecord {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampusInput {
  name: string;
  code: string;
  isActive?: boolean;
}

export interface UpdateCampusInput {
  name: string;
  code: string;
  isActive?: boolean;
}
