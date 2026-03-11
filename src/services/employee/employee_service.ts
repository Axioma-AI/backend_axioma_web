import { EmployeeCreateDTO, EmployeePatchDTO } from "../../schemas/employee/dto/employee_dto";
import { EmployeeRepository } from "../../repositories/employee/employee_repository";
import { NotFoundError } from "../../utils/errors";

class EmployeeService {
  constructor(private employeeRepository: EmployeeRepository) {
    this.employeeRepository = employeeRepository;
  }

  async getEmployees(
    page: number,
    pageSize: number,
    filters?: { companyId?: number | null; departmentId?: number | null; cityId?: number | null },
  ) {
    return await this.employeeRepository.getEmployeesPaginated(page, pageSize, {
      company_id: filters?.companyId,
      department_id: filters?.departmentId,
      city_id: filters?.cityId,
    });
  }

  async getEmployeeDetails(id: number) {
    const emp = await this.employeeRepository.getEmployeeById(id);
    if (!emp) {
      throw new NotFoundError("Employee not found");
    }
    return emp;
  }

  async createNewEmployee(data: EmployeeCreateDTO) {
    return await this.employeeRepository.createEmployee(data);
  }

  async patchEmployeeInfo(id: number, data: EmployeePatchDTO) {
    const existing = await this.employeeRepository.getEmployeeById(id);
    if (!existing) {
      throw new NotFoundError("Employee not found");
    }
    return await this.employeeRepository.patchEmployee(id, data);
  }

  async removeEmployee(id: number) {
    const existing = await this.employeeRepository.getEmployeeById(id);
    if (!existing) {
      throw new NotFoundError("Employee not found");
    }
    return await this.employeeRepository.deleteEmployee(id);
  }
}

export default EmployeeService;
