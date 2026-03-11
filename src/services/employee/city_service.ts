import { CityDTO } from "../../schemas/employee/dto/city_dto";
import { CityRepository } from "../../repositories/employee/city_repository";
import { NotFoundError } from "../../utils/errors";

class CityService {
  constructor(private cityRepository: CityRepository) {
    this.cityRepository = cityRepository;
  }

  async getCityDetails(id: number) {
    const city = await this.cityRepository.getCityById(id);
    if (!city) {
      throw new NotFoundError("City not found");
    }
    return city;
  }

  async createNewCity(data: CityDTO) {
    const city = await this.cityRepository.createCity(data);
    return city;
  }

  async updateCityInfo(id: number, updateData: Partial<CityDTO>) {
    const city = await this.cityRepository.patchCity(id, updateData);
    return city;
  }
  
  async removeCity(id: number) {
    const city = await this.cityRepository.deleteCity(id);
    return city;
  }

  async getCities(page: number, pageSize: number) {
    const result = await this.cityRepository.getCitiesPaginated(page, pageSize);
    return result;
  }
}

export default CityService;
