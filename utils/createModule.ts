import { v4 as uuid } from 'uuid';

export function createModule(type:string) {
  return {
    id: uuid(),
    type,
    name: type,
    rate: 60,
    transport: ['ws'],
    autoSend: true
  };
}

