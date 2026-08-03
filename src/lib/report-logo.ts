// The Quizotic mark, embedded as a base64 PNG so the workbook builder stays a
// pure function — no filesystem read at request time, and no asset path that
// can break when the app is bundled for Railway.
//
// Regenerate from public/brand/quizotic-mark.svg with:
//   sharp(svg).resize(96, 96).png({ compressionLevel: 9, palette: true })
// XLSX cannot embed fonts, but it can embed images — so the mark is the one
// piece of brand identity guaranteed to render identically on every machine.

export const QUIZOTIC_MARK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAB/lBMVEVMaXH60Dr60Tv/3z/60Dv70Tr//wD60Dr60Tv60Tr6" +
  "0Dv40Tr70Dv30jz70Tv4zj760Dr60Tv31Dj60Tr/2kj70Dv70Dv70Tn60Dr40Dz/xjj40jn60Tr70Tv60Tv5zzv70Dv60Tz7" +
  "0Tv70Dv60Tv/zTn60Tv40zf70Dv3zzf60Dr70Dr60Tv60Tv30D370Tr60Dr60Dn70Dr50Dn60Dv7zzv7zzr70Dv70Tv7zzr7" +
  "0Tn70Dr70jz70jv70Dn70Dr70Dn70Tr30zr60Dv60Tr70Tr60Tv70Tr70Dr70Dv70Dv50Tj70TsPGz34zztjWzz2zjtcVjwR" +
  "HT360DsSHT1dVzwrMT3cuTv3zjvnwjveuztiWz0XIT0QHD3lwDvbuDuNfDsqMD2QfjxkXDxGRT2MfDzmwTsWID31zTt8cDyu" +
  "ljz5zzurlDw1OTzgvDvpwzwzNz2qkzyPfTwtMz17bzxhWjzHqTuLezzFpzyRfzyFdjyOfDyTgDxGRj2UgTzfuzvivjtERDyj" +
  "jTxDQz2iizyjjDx9cD30zDt5bTy1nDzowzsVHz24njuSgDxfWDyKejy2nDy3nTvdujxHRzx6bjyhizuGdzxFRTw0ODxwZjz6" +
  "0TtIRzx4bDx/cTxJSD2IeDw2OT370Dt+cDwsMj1xZzzEpzuHeDwYIj2JeTzIqjvdHjB8AAAATHRSTlMA8/AI+YIB+PH7/See" +
  "Is8lf+QkoQeFUkP3Jgko5oHlK9xqgMX6H2spnyCg3d/gIchtbscspEBG0s5BVM1QRUfQQtUj46LEo52DhMYtPlIJWwAAAAlw" +
  "SFlzAAALEwAACxMBAJqcGAAABAdJREFUeNq1mvdD00AUxw9oaSsggoIooCjLiQi4917XUlqiUKAiLYUiskSWMl24RcG9t/+l" +
  "pZImvUua197d+y2Xe99PcjvvBaFoS63euWVHgRUnYNaCqk2V61NRLMs4ux0z2jZzha58Wo0NczDbyUxN+bU5JszJLOYUjcc/" +
  "gjnasfWk/u4kzNWsq6P195swZ7PkqvWPWjB3Mx1W9POTsACzromMnz1YiC2Xx1IOFmSFSwPUJApgyQ4DarAw2xJef2ziALbN" +
  "IcA5LNA2htbnONbPxv4nH2ZvdTfCPbamogvQug0Lt132sLmm7zigXuVoJ7Dmgz67yt48B7qVoZWgeu5Wlz3KWu5dBTmmox2g" +
  "5mmyU9bUAPEsRusAtRy1dg2rcwJcs1BSovowghUtS1gfRFiGGPRBBMSiDyEgJn0AAbHpGxMQo74hAbHqGxEQs74BAbHrxyYg" +
  "DvoxCYiHfiwCguvXv38yFHA6A0OjL+vhBATVb/6m2ikDwWYoAQH1n05F1+iRgAQE0m8ZcxvucToEBNF3dWu59oMIGgD3DfLt" +
  "27Wb9w+1i7pBgDGq/fVOAnVkzV8QwIMWcvz06I3xqd9kW84ZAxzXyMf6qL8OBMm6fQ2GgAVqfqnG/4tnPt+wR7n2UjPuriHg" +
  "NunySbnX+mixoOOmUjJO1vYbARrJsWe/pejLRQORojbqfR8aALqpVeZvpH0eyUUdkVYaoap3GQCoR7JHumBYY2J47fovrA2Y" +
  "pTw65Vuq+Vcrl92nqg8aAOb1AaoDsE8fEDQAjIKaqFW/iSbi7uQh+ZanIzK3J+Wyn3F38kNq6oxG7t2Ui9roosgw7TWaaNOk" +
  "y0vl3kD4HZoVffyarD1uOJPvUM8UUG562n2+9knl+up1svZMAotdMMax6tLFuBc7/JxarifBBNdjyIbzinwFyR2D4FG30ucE" +
  "t8xnGEYAbpkam34/hrSS5OR5bKEJkpPl4FXXY0SQnIxHx0GvavzTBMnJfPh1jbeNeDs7vSMD/u+XyZ7+4eR7fL9CEt7x/gCh" +
  "CNw/oaCExD8CgQSGz1gYgeVD/OIlZgAHAlswBEBgDOe8/coMiEmQAAEplpCaBAmpMQQFJVBQMPGwJkQfn0BVYgOzp8SHliuB" +
  "q+Jc1Hnpy2Og2wZUDQ3UO+76l86t9f4ZcHg/DaVug6cbersm5gcnunrhHkWhFItZZIplRQhQITBJVFK6mIY6LQ6QHs6jZVpE" +
  "6edl/E8FmkX2wKKlLBejf2CVnI5dYxWhn3xcSSjvE5GwPqROiedyJ1gORif1V3NupeRd5G8JmVx7em82/WNFiplbM+WtWKX5" +
  "b0j2Si6rRsmmDN2/WzYXbmWVL9pYGvP/HFReln4+Kzmhfs0qPrMhnxT8B+eqUauEtuMpAAAAAElFTkSuQmCC"; 
