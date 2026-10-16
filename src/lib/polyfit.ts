/**
 * (lon, lat) -> kmoni 352x400 픽셀 (px, py) 2차 2변수 다항 회귀 투영.
 * x = a0 + a1*lon + a2*lat + a3*lon*lat + a4*lon^2 + a5*lat^2
 * y = b0 + b1*lon + b2*lat + b3*lon*lat + b4*lon^2 + b5*lat^2
 */
export class PolyProj {
  private coeffX: number[] = [];
  private coeffY: number[] = [];

  train(points: any[]): void {
    const validPoints = points.filter(
      p => p.Location && p.Point && typeof p.Point.x === 'number' && typeof p.Point.y === 'number'
    );

    if (validPoints.length < 10) return;

    const m = 6;
    const A: number[][] = [];
    const Yx: number[] = [];
    const Yy: number[] = [];

    for (const p of validPoints) {
      const lon = p.Location.longitude;
      const lat = p.Location.latitude;
      const px = p.Point.x;
      const py = p.Point.y;

      A.push([1, lon, lat, lon * lat, lon * lon, lat * lat]);
      Yx.push(px);
      Yy.push(py);
    }

    // Normal Equation (A^T * A) * Coeff = A^T * Y
    this.coeffX = this.solveLeastSquares(A, Yx, m);
    this.coeffY = this.solveLeastSquares(A, Yy, m);
  }

  private solveLeastSquares(A: number[][], Y: number[], m: number): number[] {
    const n = A.length;
    const ATA: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    const ATY: number[] = new Array(m).fill(0);

    for (let i = 0; i < n; i++) {
      for (let r = 0; r < m; r++) {
        ATY[r] += A[i][r] * Y[i];
        for (let c = 0; c < m; c++) {
          ATA[r][c] += A[i][r] * A[i][c];
        }
      }
    }

    // Partial Pivoting Gaussian Elimination
    for (let i = 0; i < m; i++) {
      let maxRow = i;
      for (let k = i + 1; k < m; k++) {
        if (Math.abs(ATA[k][i]) > Math.abs(ATA[maxRow][i])) maxRow = k;
      }

      const tmpRow = ATA[i];
      ATA[i] = ATA[maxRow];
      ATA[maxRow] = tmpRow;

      const tmpY = ATY[i];
      ATY[i] = ATY[maxRow];
      ATY[maxRow] = tmpY;

      if (Math.abs(ATA[i][i]) < 1e-12) continue;

      for (let k = i + 1; k < m; k++) {
        const factor = ATA[k][i] / ATA[i][i];
        ATY[k] -= factor * ATY[i];
        for (let j = i; j < m; j++) {
          ATA[k][j] -= factor * ATA[i][j];
        }
      }
    }

    const Coeff = new Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--) {
      let sum = ATY[i];
      for (let j = i + 1; j < m; j++) {
        sum -= ATA[i][j] * Coeff[j];
      }
      Coeff[i] = sum / ATA[i][i];
    }

    return Coeff;
  }

  toPixel(lon: number, lat: number): { x: number; y: number } | null {
    if (this.coeffX.length < 6 || this.coeffY.length < 6) return null;

    const terms = [1, lon, lat, lon * lat, lon * lon, lat * lat];
    let px = 0;
    let py = 0;

    for (let i = 0; i < 6; i++) {
      px += this.coeffX[i] * terms[i];
      py += this.coeffY[i] * terms[i];
    }

    const rx = Math.round(px);
    const ry = Math.round(py);

    if (rx < 0 || rx >= 352 || ry < 0 || ry >= 400) return null;
    return { x: rx, y: ry };
  }
}

/**
 * 각 예보구역 폴리곤별 픽셀 샘플 Lookup Table 생성.
 */
export function buildLUT(features: any[], proj: PolyProj): Map<string, { x: number; y: number }[]> {
  const lut = new Map<string, { x: number; y: number }[]>();

  for (const feature of features) {
    const code = feature.properties?.code;
    if (!code) continue;

    const pixels: { x: number; y: number }[] = [];
    const pixelSet = new Set<string>();

    const addPixel = (lon: number, lat: number) => {
      const p = proj.toPixel(lon, lat);
      if (p) {
        const key = `${p.x},${p.y}`;
        if (!pixelSet.has(key)) {
          pixelSet.add(key);
          pixels.push(p);
        }
      }
    };

    const processCoordinates = (coords: any) => {
      if (!Array.isArray(coords) || coords.length === 0) return;

      if (typeof coords[0] === 'number') {
        addPixel(coords[0], coords[1]);
        return;
      }

      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;

      for (const pt of coords) {
        if (Array.isArray(pt) && typeof pt[0] === 'number') {
          const lon = pt[0];
          const lat = pt[1];
          addPixel(lon, lat);

          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        } else if (Array.isArray(pt)) {
          processCoordinates(pt);
        }
      }

      // bbox가 유효하면 내부 그리드 샘플링
      if (minLon < maxLon && minLat < maxLat) {
        const lonStep = Math.max(0.04, (maxLon - minLon) / 5);
        const latStep = Math.max(0.04, (maxLat - minLat) / 5);

        for (let lon = minLon; lon <= maxLon; lon += lonStep) {
          for (let lat = minLat; lat <= maxLat; lat += latStep) {
            addPixel(lon, lat);
          }
        }
      }
    };

    if (feature.geometry && feature.geometry.coordinates) {
      processCoordinates(feature.geometry.coordinates);
    }

    lut.set(code, pixels);
  }

  return lut;
}
