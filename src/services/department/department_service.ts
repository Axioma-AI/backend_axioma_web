import { DepartmentCreateDTO, DepartmentPatchDTO } from "../../schemas/department/dto/department_dto";
import { DepartmentRepository } from "../../repositories/department/department_repository";
import { NotFoundError } from "../../utils/errors";

class DepartmentService {
  constructor(private departmentRepository: DepartmentRepository) {
    this.departmentRepository = departmentRepository;
  }

  async getDepartments(page: number, pageSize: number, companyId?: number) {
    return await this.departmentRepository.getDepartmentsPaginated(page, pageSize, {
      company_id: companyId,
    });
  }

  async getDepartmentDetails(id: number) {
    const dep = await this.departmentRepository.getDepartmentById(id);
    if (!dep) {
      throw new NotFoundError("Department not found");
    }
    return dep;
  }

  async createNewDepartment(data: DepartmentCreateDTO) {
    return await this.departmentRepository.createDepartment(data);
  }

  async patchDepartmentInfo(id: number, data: DepartmentPatchDTO) {
    const existing = await this.departmentRepository.getDepartmentById(id);
    if (!existing) {
      throw new NotFoundError("Department not found");
    }
    return await this.departmentRepository.patchDepartment(id, data);
  }

  async removeDepartment(id: number) {
    const existing = await this.departmentRepository.getDepartmentById(id);
    if (!existing) {
      throw new NotFoundError("Department not found");
    }
    return await this.departmentRepository.deleteDepartment(id);
  }
}

export default DepartmentService;
