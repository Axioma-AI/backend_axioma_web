import { CommitteeTypeDTO } from "../../schemas/committees/dto/committee_type_dto";
import { CommitteeTypeRepository } from "../../repositories/committees/committee_type_repository";
import { NotFoundError } from "../../utils/errors";

class CommitteeTypeService {
  constructor(private committeeTypeRepository: CommitteeTypeRepository) {
    this.committeeTypeRepository = committeeTypeRepository;
  }

  async getCommitteeTypeDetails(id: number) {
    const committeeType = await this.committeeTypeRepository.getCommitteeTypeById(id);
    if (!committeeType) {
      throw new NotFoundError("Committee type not found");
    }
    return committeeType;
  }

  async createNewCommitteeType(data: CommitteeTypeDTO) {
    const committeeType = await this.committeeTypeRepository.createCommitteeType(data);
    return committeeType;
  }

  async updateCommitteeTypeInfo(id: number, updateData: Partial<CommitteeTypeDTO>) {
    const committeeType = await this.committeeTypeRepository.patchCommitteeType(id, updateData);
    return committeeType;
  }

  async removeCommitteeType(id: number) {
    const committeeType = await this.committeeTypeRepository.deleteCommitteeType(id);
    return committeeType;
  }

  async getCommitteeTypes(page: number, pageSize: number) {
    const result = await this.committeeTypeRepository.getCommitteeTypesPaginated(page, pageSize);
    return result;
  }
}

export default CommitteeTypeService;
