import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { config } from '../../config';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {
    const { name, password } = config.admin;
    this.createUser({ name, password, role: 'admin' })
      .then((_) => {
        console.log();
        console.log(
          `管理员账户创建成功，用户名：${name}，密码：${password}，请及时登录系统修改默认密码`
        );
        console.log();
      })
      .catch((_) => {
        console.log();
        console.log(
          `管理员账户已经存在，用户名：${name}，密码：${password}，请及时登录系统修改默认密码`
        );
        console.log();
      });
  }

  async findAll(queryParams: any = {}): Promise<[User[], number]> {
    const query = this.userRepository.createQueryBuilder('user').orderBy('user.createAt', 'DESC');

    const { page = 1, pageSize = 12, status, ...otherParams } = queryParams;

    query.skip((+page - 1) * +pageSize);
    query.take(+pageSize);

    if (status) {
      query.andWhere('user.status=:status').setParameter('status', status);
    }

    if (otherParams) {
      Object.keys(otherParams).forEach((key) => {
        query.andWhere(`user.${key} LIKE :${key}`).setParameter(`${key}`, `%${otherParams[key]}%`);
      });
    }

    return query.getManyAndCount();
  }

  /**
   * 创建用户
   * @param user
   */
  async createUser(user: Partial<User>): Promise<User> {
    const { name } = user;
    const existUser = await this.userRepository.findOne({ where: { name } });

    if (existUser) {
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
    }

    const newUser = await this.userRepository.create(user);
    await this.userRepository.save(newUser);
    return newUser;
  }

  /**
   * 用户登录
   * @param user
   */
  async login(user: Partial<User>): Promise<User> {
    const { name, password } = user;
    const existUser = await this.userRepository.findOne({ where: { name } });

    if (!existUser || !(await User.comparePassword(password, existUser.password))) {
      throw new HttpException(
        '用户名或密码错误',
        // tslint:disable-next-line: trailing-comma
        HttpStatus.BAD_REQUEST
      );
    }

    if (existUser.status === 'locked') {
      throw new HttpException(
        '用户已锁定，无法登录',
        // tslint:disable-next-line: trailing-comma
        HttpStatus.BAD_REQUEST
      );
    }

    return existUser;
  }

  /**
   * 获取指定用户
   * @param id
   */
  async findById(id): Promise<User> {
    return this.userRepository.findOne(id);
  }

  /**
   * 更新指定用户
   * @param id
   */
  async updateById(id, user): Promise<User> {
    const oldUser = await this.userRepository.findOne(id);
    delete user.password;
    const newUser = await this.userRepository.merge(oldUser, user);
    return this.userRepository.save(newUser);
  }

  /**
   * 更新指定用户密码
   * @param id
   */
  async updatePassword(id, user): Promise<User> {
    const existUser = await this.userRepository.findOne(id);
    const { oldPassword, newPassword } = user;

    if (!existUser || !(await User.comparePassword(oldPassword, existUser.password))) {
      throw new HttpException(
        '用户名或密码错误',
        // tslint:disable-next-line: trailing-comma
        HttpStatus.BAD_REQUEST
      );
    }

    const hashNewPassword = User.encryptPassword(newPassword);
    const newUser = await this.userRepository.merge(existUser, {
      password: hashNewPassword,
    });
    return this.userRepository.save(newUser);
  }
}
