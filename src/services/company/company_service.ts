import { CompanyCreateDTO, CompanyPhoneItemCreateDTO, CompanyPhoneItemUpdateDTO, CompanyUpdateDTO } from '../../schemas/company/dto';
import { CompanyRepository } from '../../repositories/company/company_repository';
import { NotFoundError } from '../../utils/errors';
import { CompanyPhonesRepository } from '../../repositories/company/company_phones_repository';

class CompanyService {
  constructor(private companyRepository: CompanyRepository, private companyPhonesRepository: CompanyPhonesRepository) {
    this.companyRepository = companyRepository;
    this.companyPhonesRepository = companyPhonesRepository;
  }

  async getCompanies(page: number, pageSize: number) {
    const companies = await this.companyRepository.getCompaniesPaginated(page, pageSize);
    return companies;
  }

  async getCompanyDetails(companyId: number) {
    const company = await this.companyRepository.getCompanyById(companyId);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    const phones = await this.companyPhonesRepository.getCompanyPhonesByCompanyId(companyId);
    return { ...company, phones };
  }

  async createNewCompany(companyData: CompanyCreateDTO) {
    const { phones, ...companyFields } = companyData;
    const company = await this.companyRepository.createCompany(companyFields);
    let createdPhones : CompanyPhoneItemCreateDTO[] = [];
    if(phones.length > 0){ 
        createdPhones = await this.companyPhonesRepository.createCompanyPhonesBatch(phones.map(phone => ({...phone, company_id: company.id}))); 
    }
    return {...company, phones: createdPhones};
  }

  async updateCompanyInfo(companyId: number, updateData: CompanyUpdateDTO) {
    const { phones, ...companyFields } = updateData;
    const company = await this.companyRepository.updateCompany(companyId, companyFields);
    let newPhones : CompanyPhoneItemUpdateDTO[] = phones || [];
    if (phones) {
        await this.companyPhonesRepository.deleteCompanyPhonesByCompanyId(companyId);
        newPhones = await this.companyPhonesRepository.createCompanyPhonesBatch(newPhones.map(phone => ({...phone, company_id: companyId}))); 
    }
    return {...company, phones: newPhones};
  }

  async removeCompany(companyId: number) {
    const phones = await this.companyPhonesRepository.getCompanyPhonesByCompanyId(companyId);
    if (phones.length > 0) await this.companyPhonesRepository.deleteCompanyPhonesBatch(phones.map((p) => p.id));
    const company = await this.companyRepository.deleteCompany(companyId);
    return { ...company, phones };
  }
}

export default CompanyService;
