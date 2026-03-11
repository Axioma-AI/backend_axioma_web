import { OrganizationDTO } from "../../schemas/organization/dto";
import { OrganizationRepository} from "../../repositories/organization/organization_repository";
import { NotFoundError } from "../../utils/errors";

class OrganizationService {
  constructor(private organizationRepository: OrganizationRepository) {
    this.organizationRepository = organizationRepository;
  }

  async getOrganizationDetails(orgId: number) {
    const organization = await this.organizationRepository.getOrganizationById(orgId);
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }
    return organization;
  }

  async createNewOrganization(orgData: OrganizationDTO) {
    const organization = await this.organizationRepository.createOrganization(orgData);
    return organization;
  }

  async updateOrganizationInfo(orgId: number, updateData: Partial<OrganizationDTO>) {
    const organization = await this.organizationRepository.updateOrganization(orgId, updateData);
    return organization;
  }

  async removeOrganization(orgId: number) {
    const organization = await this.organizationRepository.deleteOrganization(orgId);
    return organization;
  }

  async getOrganizations(page: number, pageSize: number) {
    const organizations = await this.organizationRepository.getOrganizationsPaginated(page, pageSize);
    return organizations;
  }
}

export default OrganizationService;
