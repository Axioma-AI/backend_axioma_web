import { ReminderTypeDTO } from "../../schemas/committees/dto/reminder_type_dto";
import { ReminderTypeRepository } from "../../repositories/committees/reminder_type_repository";
import { NotFoundError } from "../../utils/errors";

class ReminderTypeService {
  constructor(private reminderTypeRepository: ReminderTypeRepository) {
    this.reminderTypeRepository = reminderTypeRepository;
  }

  async getReminderTypeDetails(id: number) {
    const reminderType = await this.reminderTypeRepository.getReminderTypeById(id);
    if (!reminderType) throw new NotFoundError("Reminder type not found");
    return reminderType;
  }

  async createNewReminderType(data: ReminderTypeDTO) {
    const reminderType = await this.reminderTypeRepository.createReminderType(data);
    return reminderType;
  }

  async updateReminderTypeInfo(id: number, updateData: Partial<ReminderTypeDTO>) {
    const reminderType = await this.reminderTypeRepository.patchReminderType(id, updateData);
    return reminderType;
  }

  async removeReminderType(id: number) {
    const reminderType = await this.reminderTypeRepository.deleteReminderType(id);
    return reminderType;
  }

  async getReminderTypes(page: number, pageSize: number) {
    const result = await this.reminderTypeRepository.getReminderTypesPaginated(page, pageSize);
    return result;
  }
}

export default ReminderTypeService;
