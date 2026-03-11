import { CompanyPhonesEntity, CompanyPhonesRepository } from "../../repositories/company/company_phones_repository";
import { CompanyPhonesDTO } from "../../schemas/company/dto";
import { NotFoundError } from "../../utils/errors";

class CompanyPhonesService {
  constructor(private companyPhonesRepository: CompanyPhonesRepository) {
    this.companyPhonesRepository = companyPhonesRepository;
  }

  async getCompanyPhoneById(id: number): Promise<CompanyPhonesEntity> {
    const phone = await this.companyPhonesRepository.getCompanyPhoneById(id);

    if (!phone) {
      throw new NotFoundError("Company phone not found");
    }

    return phone;
  }

  async getCompanyPhonesByCompanyId(companyId: number): Promise<CompanyPhonesEntity[]> {
    const phones =
      await this.companyPhonesRepository.getCompanyPhonesByCompanyId(companyId);

    return phones;
  }

  async createCompanyPhone(createData: CompanyPhonesDTO): Promise<CompanyPhonesEntity> {
    const phone =
      await this.companyPhonesRepository.createCompanyPhone(createData);

    return phone;
  }

  async updateCompanyPhone(id: number, updateData: Partial<CompanyPhonesDTO>): Promise<CompanyPhonesEntity> {
    const existing = await this.companyPhonesRepository.getCompanyPhoneById(id);

    if (!existing) {
      throw new NotFoundError("Company phone not found");
    }

    const phone = await this.companyPhonesRepository.updateCompanyPhone(
      id,
      updateData,
    );

    return phone;
  }

  async deleteCompanyPhone(id: number): Promise<CompanyPhonesEntity> {
    const existing = await this.companyPhonesRepository.getCompanyPhoneById(id);

    if (!existing) {
      throw new NotFoundError("Company phone not found");
    }

    const phone = await this.companyPhonesRepository.deleteCompanyPhone(id);

    return phone;
  }
}

export default CompanyPhonesService;
