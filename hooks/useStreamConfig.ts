export function useStreamConfig(streamId: string) {
  if (streamId.includes('motion')) {
    return {
      type: 'imu',
      channels: ['ax','ay','az','gx','gy','gz']
    };
  }

  return {
    type: 'generic',
    channels: ['value']
  };
}

