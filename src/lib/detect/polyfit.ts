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

  /** (lon, lat) → 픽셀 좌표(float). 미학습 시 null. 범위 클리핑은 호출부(라스터라이저) 담당 */
  toPixelF(lon: number, lat: number): { x: number; y: number } | null {
    if (this.coeffX.length < 6 || this.coeffY.length < 6) return null;

    const terms = [1, lon, lat, lon * lat, lon * lon, lat * lat];
    let px = 0;
    let py = 0;

    for (let i = 0; i < 6; i++) {
      px += this.coeffX[i] * terms[i];
      py += this.coeffY[i] * terms[i];
    }

    return { x: px, y: py };
  }
}
