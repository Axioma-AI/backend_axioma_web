import { CommitteeCreateDTO, CommitteePatchDTO } from "../../schemas/committees/dto/committees_dto";
import { CommitteesRepository } from "../../repositories/committees/commmittees_repository";
import { NotFoundError } from "../../utils/errors";

class CommitteeService {
  constructor(private committeeRepository: CommitteesRepository) {
    this.committeeRepository = committeeRepository;
  }

  async getCommittees(page: number, pageSize: number, companyId?: number) {
    return await this.committeeRepository.getCommitteesPaginated(page, pageSize, {
      company_id: companyId,
    });
  }

  async getCommitteeDetails(id: number) {
    const committee = await this.committeeRepository.getCommitteeById(id);
    if (!committee) {
      throw new NotFoundError("Committee not found");
    }
    return committee;
  }

  async createNewCommittee(data: CommitteeCreateDTO) {
    return await this.committeeRepository.createCommittee(data);
  }

  async patchCommitteeInfo(id: number, data: CommitteePatchDTO) {
    const existing = await this.committeeRepository.getCommitteeById(id);
    if (!existing) {
      throw new NotFoundError("Committee not found");
    }
    return await this.committeeRepository.patchCommittee(id, data);
  }

  async removeCommittee(id: number) {
    const existing = await this.committeeRepository.getCommitteeById(id);
    if (!existing) {
      throw new NotFoundError("Committee not found");
    }
    return await this.committeeRepository.deleteCommittee(id);
  }
}

export default CommitteeService;
