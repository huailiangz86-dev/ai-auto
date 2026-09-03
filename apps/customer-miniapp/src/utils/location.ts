export interface LocationResult {
  latitude?: number
  longitude?: number
  city?: string
  failed: boolean
}

export function getCurrentLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    uni.getLocation({
      type: 'gcj02',
      success: (result) =>
        resolve({ latitude: result.latitude, longitude: result.longitude, failed: false }),
      fail: () => resolve({ failed: true }),
    })
  })
}

export function formatDistance(distance?: number | null): string {
  if (distance === null || distance === undefined) return '距离待获取'
  return distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`
}
