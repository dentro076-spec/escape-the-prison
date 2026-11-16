/* Escape the prison \u2014 Chapter 1
   A small self-contained WebGL2 renderer: procedural prison, garage, tunnel, bridge,
   basement and sewer; the Givanium Citizen animated in code; Clawrenzo from baked
   clips; first-person movement with an on-screen joystick and a flashlight. */
(function () {
  'use strict';

  /* ================= math ================= */
  const M4 = {
    ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    mul(a, b, o) {
      o = o || new Float32Array(16);
      const r = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let w = 0; w < 4; w++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + w] * b[c * 4 + k];
        r[c * 4 + w] = s;
      }
      o.set(r); return o;
    },
    trs(t, q, s, o) {
      o = o || new Float32Array(16);
      const [x, y, z, w] = q, x2 = x + x, y2 = y + y, z2 = z + z;
      const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
      o[0] = (1 - (yy + zz)) * s[0]; o[1] = (xy + wz) * s[0]; o[2] = (xz - wy) * s[0]; o[3] = 0;
      o[4] = (xy - wz) * s[1]; o[5] = (1 - (xx + zz)) * s[1]; o[6] = (yz + wx) * s[1]; o[7] = 0;
      o[8] = (xz + wy) * s[2]; o[9] = (yz - wx) * s[2]; o[10] = (1 - (xx + yy)) * s[2]; o[11] = 0;
      o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
      return o;
    },
    invert(a) {
      const o = new Float32Array(16);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return M4.ident();
      det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },
    persp(fovy, asp, n, f) {
      const o = new Float32Array(16), t = 1 / Math.tan(fovy / 2);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    lookAt(e, c, up) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const o = new Float32Array(16);
      o[0] = xx; o[1] = yx; o[2] = zx; o[4] = xy; o[5] = yy; o[6] = zy; o[8] = xz; o[9] = yz; o[10] = zz;
      o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]); o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
      o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1;
      return o;
    },
    xform(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
  };
  const Q = {
    aa(x, y, z, a) { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; },
    mul(a, b) {
      return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
              a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
              a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
              a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    },
    euler(rx, ry, rz) { return Q.mul(Q.mul(Q.aa(1, 0, 0, rx), Q.aa(0, 1, 0, ry)), Q.aa(0, 0, 1, rz)); }
  };
  const D = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ================= shaders ================= */
  const VS_WORLD = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUv;
  uniform mat4 uVP, uModel;
  out vec3 vPos; out vec3 vNor; out vec2 vUv; out vec3 vLocal;
  void main(){ vec4 w = uModel*vec4(aPos,1.); vPos=w.xyz; vNor=mat3(uModel)*aNor; vUv=aUv; vLocal=aPos; gl_Position=uVP*w; }`;

  const VS_SKIN = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUv; layout(location=3) in vec4 aJoint; layout(location=4) in vec4 aWeight;
  uniform mat4 uVP, uModel; uniform sampler2D uBones;
  out vec3 vPos; out vec3 vNor; out vec2 vUv; out vec3 vLocal;
  mat4 bone(float i){ int r=int(i+.5); return mat4(texelFetch(uBones,ivec2(0,r),0),texelFetch(uBones,ivec2(1,r),0),texelFetch(uBones,ivec2(2,r),0),texelFetch(uBones,ivec2(3,r),0)); }
  void main(){
    mat4 S = bone(aJoint.x)*aWeight.x + bone(aJoint.y)*aWeight.y + bone(aJoint.z)*aWeight.z + bone(aJoint.w)*aWeight.w;
    vec4 p = S*vec4(aPos,1.);
    vec4 w = uModel*p; vPos=w.xyz; vNor=mat3(uModel)*(mat3(S)*aNor); vUv=aUv; vLocal=aPos;
    gl_Position=uVP*w;
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec3 vPos; in vec3 vNor; in vec2 vUv; in vec3 vLocal;
  uniform sampler2D uTex; uniform int uUseTex; uniform int uMode; uniform int uFlip;
  uniform vec3 uColor; uniform vec3 uEmissive; uniform float uSpec; uniform float uShine; uniform float uAlpha;
  uniform vec3 uCam; uniform vec3 uAmb; uniform vec3 uFogCol; uniform float uFogDen;
  uniform vec3 uLPos[8]; uniform vec3 uLCol[8]; uniform float uLRange[8]; uniform int uLCount;
  uniform float uSkinNoise; uniform float uTime;
  uniform vec3 uSpotPos; uniform vec3 uSpotDir; uniform vec3 uSpotCol; uniform vec2 uSpotCos;
  out vec4 o;
  float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fog(){ float d=length(uCam-vPos)*uFogDen; return 1.-exp(-d*d); }
  void main(){
    if(uMode==1){ // blob shadow
      float r=length(vUv*2.-1.); o=vec4(0.,0.,0.,(1.-smoothstep(.15,1.,r))*uAlpha); return; }
    if(uMode==2){ // glow sprite (additive)
      float r=length(vUv*2.-1.); float g=pow(max(0.,1.-r),2.6);
      o=vec4(uColor*g*uAlpha*(1.-fog()*.85),1.); return; }
    if(uMode==3){ // light cone (additive)
      vec3 V=normalize(uCam-vPos); vec3 N=normalize(vNor);
      float edge=pow(abs(dot(N,V)),1.6); float h=pow(vUv.y,1.3);
      o=vec4(uColor*edge*h*uAlpha*(1.-fog()*.7),1.); return; }
    if(uMode==5){ vec3 e=texture(uTex,vUv).rgb*uColor; o=vec4(mix(e,uFogCol,fog()*.85),1.); return; }
    vec3 base=uColor; if(uUseTex==1) base*=texture(uTex,vUv).rgb;
    if(uSkinNoise>0.){ float n=vn(vLocal*.018)*.6+vn(vLocal*.05)*.4; base*=mix(1.-uSkinNoise,1.+uSkinNoise*.5,n); }
    vec3 N=normalize(vNor); vec3 V=normalize(uCam-vPos);
    if(uFlip==1 && dot(N,V)<0.) N=-N;
    if(uMode==4){ // rippling water
      vec2 q=vPos.xz; N=normalize(vec3((vn(vec3(q*1.6,uTime*.5))-.5)*.5,1.,(vn(vec3(q.yx*1.9+7.,uTime*.45))-.5)*.5)); }
    vec3 col=base*uAmb*(.6+.4*max(N.y,0.));
    for(int i=0;i<8;i++){ if(i>=uLCount) break;
      vec3 L=uLPos[i]-vPos; float d=length(L); L/=d;
      float win=clamp(1.-pow(d/uLRange[i],4.),0.,1.); float att=win*win/(1.+.35*d*d);
      float ndl=max(dot(N,L),0.);
      vec3 H=normalize(L+V); float sp=pow(max(dot(N,H),0.),uShine)*uSpec;
      col+=(base*ndl+sp)*uLCol[i]*att; }
    if(uSpotCol.r+uSpotCol.g+uSpotCol.b>0.){ // flashlight
      vec3 L=uSpotPos-vPos; float d=length(L); L/=d;
      float cone=smoothstep(uSpotCos.y,uSpotCos.x,dot(-L,uSpotDir));
      float win=clamp(1.-pow(d/24.,4.),0.,1.); float att=cone*win/(1.+.035*d*d);
      float ndl=max(dot(N,L),0.); vec3 H=normalize(L+V); float sp=pow(max(dot(N,H),0.),uShine)*uSpec;
      col+=(base*ndl+sp)*uSpotCol*att; }
    col+=uEmissive;
    col=mix(col,uFogCol,fog());
    col=col/(1.+col*.15);
    o=vec4(pow(col,vec3(1./1.15)),1.);
  }`;

  /* ================= procedural textures ================= */
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, p) { // tileable value noise with period p
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const m = v => ((v % p) + p) % p;
    const a = hash(m(xi), m(yi)), b = hash(m(xi + 1), m(yi)), c = hash(m(xi), m(yi + 1)), d = hash(m(xi + 1), m(yi + 1));
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(x, y, p, oct) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, p * f); a *= .5; f *= 2; } return s; }
  function canvasTex(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); fn(g, w, h); return c;
  }
  function noiseLayer(g, w, h, period, oct, fn) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / w * period, y / h * period, period, oct), i = (y * w + x) * 4;
      fn(d, i, n, x, y); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function floorTexture() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#7d7a72'; g.fillRect(0, 0, w, h);
      noiseLayer(g, w, h, 8, 5, (d, i, n, x, y) => {
        const s = 70 + n * 95, stain = Math.max(0, fbm(x / w * 3 + 7, y / h * 3 + 3, 3, 3) - .55) * 160;
        d[i] = s - stain * .9; d[i + 1] = s - stain * .85; d[i + 2] = s * .94 - stain * .8;
      });
      g.strokeStyle = 'rgba(20,18,15,.55)'; g.lineWidth = 3;
      for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { // cracks
        let x = hash(k, 3) * w, y = hash(k, 9) * h; g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 9; s++) { x += (hash(k, s) - .5) * 40; y += (hash(s, k) - .3) * 30; g.lineTo(x, y); } g.stroke();
      }
    });
  }
  function brickTexture() { // sewer bricks, 2.4 m square
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#2d2a22'; g.fillRect(0, 0, w, h);
      const rows = 20, cols = 6, bh = h / rows, bw = w / cols;
      for (let r = 0; r < rows; r++) for (let c = -1; c < cols; c++) {
        const x = c * bw + (r % 2) * bw / 2, y = r * bh, k = hash(r * 7 + 3, c * 13 + 5);
        const v = 70 + k * 40, wet = r > rows * .72 ? 30 : 0;
        g.fillStyle = `rgb(${v + 18 - wet},${v - 4 - wet * .4},${v - 18 - wet * .6})`;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
      noiseLayer(g, w, h, 8, 4, (d, i, n, x, y) => {
        const moss = Math.max(0, (y / h - .62) * 2.2) * (.5 + n), grime = Math.max(0, fbm(x / w * 5 + 3, y / h * 5, 5, 3) - .45) * 150;
        d[i] = d[i] * (.75 + n * .4) - grime - moss * 25; d[i + 1] = d[i + 1] * (.75 + n * .4) - grime * .9 + moss * 18; d[i + 2] = d[i + 2] * (.75 + n * .4) - grime * .9 - moss * 10;
      });
    });
  }
  function signTexture(text, bg, fg) {
    return canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = fg; g.font = 'bold 72px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
      noiseLayer(g, w, h, 4, 3, (d, i, n) => { const k = .7 + n * .45; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; });
    });
  }
  function windowTexture() { // night building facade, 4x4 windows per tile
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#0b0d14'; g.fillRect(0, 0, w, h);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const k = hash(r * 31 + 7, c * 17 + 3), lit = k > .62, x = c * 64 + 14, y = r * 64 + 12;
        g.fillStyle = lit ? (k > .85 ? '#ffd28a' : '#e9a85a') : (k < .2 ? '#141a26' : '#1b2233');
        g.fillRect(x, y, 36, 40);
        if (lit) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 18, 36, 3); g.fillRect(x + 17, y, 3, 40); }
      }
    });
  }
  function wallTexture() { // 2.4 m wide x 3.2 m tall, top of canvas = ceiling
    return canvasTex(512, 512, (g, w, h) => {
      const band = h * (1 - 1.15 / 3.2); // canvas y where the lower paint starts
      noiseLayer(g, w, h, 8, 5, (d, i, n, x, y) => {
        const streak = Math.max(0, fbm(x / w * 24, y / h * 1.5, 24, 2) - .45) * (1 - y / h) * 180;
        const grime = Math.max(0, fbm(x / w * 4 + 2, y / h * 4, 4, 3) - .5) * 120;
        let r, gg, b;
        if (y > band) { r = 52; gg = 70; b = 62; } else { r = 150; gg = 146; b = 128; }
        const k = .78 + n * .4;
        d[i] = r * k - streak * .7 - grime; d[i + 1] = gg * k - streak * .7 - grime; d[i + 2] = b * k - streak * .65 - grime * .9;
      });
      g.fillStyle = 'rgba(25,32,28,.95)'; g.fillRect(0, band - 6, w, 8);       // stripe
      g.fillStyle = 'rgba(15,15,14,.85)'; g.fillRect(0, h - 14, w, 14);        // skirting
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let k = 0; k < 40; k++) { const x = hash(k, 77) * w; g.fillRect(x, band + 10 + hash(k, 5) * 40, 1.5, 6 + hash(k, 8) * 30); } // scratches
    });
  }

  /* ================= geometry ================= */
  class Geo {
    constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
    v(p, n, uv) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); return this.p.length / 3 - 1; }
    quad(a, b, c, d, n, ua, ub, uc, ud) {
      const i0 = this.v(a, n, ua), i1 = this.v(b, n, ub), i2 = this.v(c, n, uc), i3 = this.v(d, n, ud);
      this.i.push(i0, i1, i2, i0, i2, i3);
    }
    qy(x0, x1, z0, z1, y, up, su) {
      this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, up ? 1 : -1, 0],
        [x0 / su, z0 / su], [x1 / su, z0 / su], [x1 / su, z1 / su], [x0 / su, z1 / su]);
    }
    qx(x, z0, z1, y0, y1, dir, su, sv) {
      this.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [dir, 0, 0],
        [z0 / su, y0 / sv], [z1 / su, y0 / sv], [z1 / su, y1 / sv], [z0 / su, y1 / sv]);
    }
    qz(z, x0, x1, y0, y1, dir, su, sv) {
      this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, dir],
        [x0 / su, y0 / sv], [x1 / su, y0 / sv], [x1 / su, y1 / sv], [x0 / su, y1 / sv]);
    }
    box(x0, y0, z0, x1, y1, z1, su = 1, sv = 1) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      this.qx(x0, z0, z1, y0, y1, -1, su, sv); this.qx(x1, z0, z1, y0, y1, 1, su, sv);
      this.qz(z0, x0, x1, y0, y1, -1, su, sv); this.qz(z1, x0, x1, y0, y1, 1, su, sv);
      this.qy(x0, x1, z0, z1, y1, true, su); this.qy(x0, x1, z0, z1, y0, false, su);
    }
    cyl(x, z, y0, y1, r0, r1, seg) {
      const base = this.p.length / 3, slope = (r0 - r1) / (y1 - y0);
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
        const nl = Math.hypot(1, slope), n = [cx / nl, slope / nl, cz / nl];
        this.v([x + cx * r0, y0, z + cz * r0], n, [s / seg, 0]);
        this.v([x + cx * r1, y1, z + cz * r1], n, [s / seg, 1]);
      }
      for (let s = 0; s < seg; s++) { const a = base + s * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    disk(x, y, z, r, seg, up) {
      const n = [0, up ? 1 : -1, 0], c = this.v([x, y, z], n, [.5, .5]);
      for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2; this.v([x + Math.cos(a) * r, y, z + Math.sin(a) * r], n, [.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5]); }
      for (let s = 0; s < seg; s++) this.i.push(c, c + 1 + s, c + 2 + s);
    }
    boxR(cx, cy, cz, hx, hy, hz, rx, ry, rz) { // box rotated by euler angles about its centre
      const q = Q.euler(rx, ry, rz), M = M4.trs([cx, cy, cz], q, [1, 1, 1]);
      const P = (x, y, z) => M4.xform(M, [x * hx, y * hy, z * hz]), Nn = (x, y, z) => { const a = M4.xform(M, [x, y, z]); return [a[0] - cx, a[1] - cy, a[2] - cz]; };
      const F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
      for (const [n, u, v] of F) {
        const c = k => [n[0] + u[0] * k[0] + v[0] * k[1], n[1] + u[1] * k[0] + v[1] * k[1], n[2] + u[2] * k[0] + v[2] * k[1]];
        const a = c([-1, -1]), b = c([1, -1]), cc = c([1, 1]), d = c([-1, 1]);
        this.quad(P(...a), P(...b), P(...cc), P(...d), Nn(...n), [0, 0], [hx + hy, 0], [hx + hy, hz + hy], [0, hz + hy]);
      }
    }
    cylZ(z0, z1, cx, cy, r, seg) { // horizontal cylinder along z (no caps)
      const base = this.p.length / 3;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        this.v([cx + ca * r, cy + sa * r, z0], [ca, sa, 0], [0, s / seg]);
        this.v([cx + ca * r, cy + sa * r, z1], [ca, sa, 0], [1, s / seg]);
      }
      for (let s = 0; s < seg; s++) { const a = base + s * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    cylX(x0, x1, cy, cz, r, seg) { // horizontal cylinder along x, with caps
      const base = this.p.length / 3;
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        this.v([x0, cy + ca * r, cz + sa * r], [0, ca, sa], [0, s / seg]);
        this.v([x1, cy + ca * r, cz + sa * r], [0, ca, sa], [1, s / seg]);
      }
      for (let s = 0; s < seg; s++) { const a = base + s * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      for (const [xx, nx] of [[x0, -1], [x1, 1]]) {
        const c = this.v([xx, cy, cz], [nx, 0, 0], [.5, .5]);
        for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2; this.v([xx, cy + Math.cos(a) * r, cz + Math.sin(a) * r], [nx, 0, 0], [.5 + Math.cos(a) * .5, .5 + Math.sin(a) * .5]); }
        for (let s = 0; s < seg; s++) this.i.push(c, c + 1 + s, c + 2 + s);
      }
    }
  }


  /* ================= world layout ================= */
  // player cell at the near end, its bars face down the corridor (-z)
  const H = 3.2, CW = 2, CELL_D = 3.2;
  const Z_CELL_BACK = 4.9, Z_BARS = 1.5, Z_END = -15;
  const CELLS = [[-0.5, -4], [-4, -7.5], [-7.5, -11], [-11, -14.5]];
  const LAMPS_Z = [-0.9, -5.2, -9.6, -13.6];
  const DOOR_W = 0.5;
  const GX = 6, GH = 4.5, Z_GAR_END = -36;           // garage
  const TW = 4.5, TH = 5.5, Z_TUN_END = -170;        // tunnel (opens onto the bridge)
  const BRIDGE_END = -330;
  const MINES = [[0, -203], [-1.7, -207.5], [1.6, -212]], MINE_Z = -203;
  const BR_LAMPS = [[1, -182], [-1, -200], [1, -226], [-1, -252], [1, -278], [-1, -304]];
  const TRUCK_Z0 = -26.2;                            // parked truck (origin = rear of cab, ground)
  const TUN_LAMPS = [], SODIUM = [];
  for (let z = -46; z > Z_TUN_END + 6; z -= 16) TUN_LAMPS.push(z);
  for (let z = -54; z > Z_TUN_END + 6; z -= 24) SODIUM.push(z);
  const CRATES = [[-5.7, -17.0, -4.5, -18.2, 1.1], [-5.6, -18.4, -4.6, -19.4, .9], [-5.5, -17.3, -4.7, -18.0, 1.85], [4.3, -31.0, 5.6, -32.3, 1.2], [4.6, -29.6, 5.6, -30.7, .8]];
  const DRUMS = [[5.1, -17.6], [5.0, -18.6], [5.25, -19.5], [-5.1, -33.2], [-5.0, -32.2]];

  function buildWorld() {
    const g = {};
    for (const k of ['floor', 'ceil', 'wall', 'metal', 'dark', 'cloth', 'gfloor', 'concrete', 'asphalt', 'wood', 'drum', 'paint', 'bulbs', 'tubes', 'beacon', 'cones', 'tlamp', 'sodium', 'rock', 'mine', 'mineled'])
      g[k] = new Geo();
    const WU = 2.4, WV = H, FU = 2, CU = 2.6;

    /* --- prison block --- */
    g.floor.qy(-CW - CELL_D, CW + CELL_D, Z_CELL_BACK, Z_END, 0, true, FU);
    g.ceil.qy(-CW - CELL_D, CW + CELL_D, Z_CELL_BACK, Z_END, H, false, FU);
    // player's cell
    g.wall.qz(Z_CELL_BACK, -CW, CW, 0, H, -1, WU, WV);
    g.wall.qx(-CW, Z_BARS, Z_CELL_BACK, 0, H, 1, WU, WV);
    g.wall.qx(CW, Z_BARS, Z_CELL_BACK, 0, H, -1, WU, WV);
    for (let x = -CW + 0.08; x < CW - 0.05; x += 0.15) if (Math.abs(x) > DOOR_W + 0.04) g.metal.cyl(x, Z_BARS, 0, 2.45, .022, .022, 6);
    for (const [xa, xb] of [[-CW, -DOOR_W - .06], [DOOR_W + .06, CW]]) {
      g.metal.box(xa, .06, Z_BARS - .03, xb, .14, Z_BARS + .03); g.metal.box(xa, 1.12, Z_BARS - .03, xb, 1.2, Z_BARS + .03); g.metal.box(xa, 2.36, Z_BARS - .04, xb, 2.45, Z_BARS + .04);
    }
    g.metal.box(-DOOR_W - .07, 0, Z_BARS - .05, -DOOR_W - .01, 2.45, Z_BARS + .05); g.metal.box(DOOR_W + .01, 0, Z_BARS - .05, DOOR_W + .07, 2.45, Z_BARS + .05);
    g.wall.qz(Z_BARS, -CW, CW, 2.45, H, 1, WU, WV); g.wall.qz(Z_BARS, -CW, CW, 2.45, H, -1, WU, WV);
    // bunk + toilet in the player's cell
    g.metal.box(-CW, .42, 2.1, -1.1, .48, 4.5); g.cloth.box(-CW + .04, .48, 2.15, -1.14, .6, 4.45);
    for (const zz of [2.15, 4.45]) g.metal.box(-1.2, 0, zz - .03, -1.14, .45, zz + .03);
    g.metal.box(1.32, 0, 4.25, 1.78, .42, 4.72);
    // corridor walls by the player's cell + far end
    for (const side of [-1, 1]) {
      const x = side * CW, dirIn = -side;
      g.wall.qx(x, Z_BARS, CELLS[0][0], 0, H, dirIn, WU, WV);
      g.wall.qx(x, CELLS[3][1], Z_END, 0, H, dirIn, WU, WV);
      g.wall.qx(x, CELLS[0][0], CELLS[3][1], 2.45, H, dirIn, WU, WV);
      for (let c = 0; c < CELLS.length; c++) {
        const [z0, z1] = CELLS[c];
        if (c > 0) g.wall.box(x, 0, z0 + .15, x + side * .25, 2.45, z0 - .15, WU, WV);
        const za = z0 - (c > 0 ? .15 : 0.05), zb = z1 + (c < CELLS.length - 1 ? .15 : 0.05);
        for (let z = za - .07; z > zb; z -= .15) g.metal.cyl(x, z, 0, 2.45, .022, .022, 6);
        g.metal.box(x - .03, .06, zb, x + .03, .14, za); g.metal.box(x - .03, 1.12, zb, x + .03, 1.2, za); g.metal.box(x - .04, 2.36, zb, x + .04, 2.45, za);
        const xb = x + side * CELL_D;
        g.wall.qx(xb, z0, z1, 0, H, -side, WU, WV);
        g.wall.qz(z0, Math.min(x, xb), Math.max(x, xb), 0, H, -1, WU, WV);
        g.wall.qz(z1, Math.min(x, xb), Math.max(x, xb), 0, H, 1, WU, WV);
        const bx0 = xb - side * .95, bx1 = xb - side * .05;
        g.metal.box(bx0, .42, z0 - .25, bx1, .48, z0 - 2.25);
        g.cloth.box(bx0 + side * .04, .48, z0 - .3, bx1 - side * .04, .6, z0 - 2.2);
        for (const zz of [z0 - .3, z0 - 2.2]) for (const xx of [bx0, bx1]) g.metal.box(xx - .03, 0, zz - .03, xx + .03, .45, zz + .03);
        const tx = xb - side * .45, tz = z1 + .45;
        g.metal.box(tx - .22, 0, tz - .2, tx + .22, .42, tz + .2);
      }
    }
    // end wall + doorway into the garage
    g.wall.qz(Z_END, -CW, -.8, 0, H, 1, WU, WV); g.wall.qz(Z_END, .8, CW, 0, H, 1, WU, WV); g.wall.qz(Z_END, -.8, .8, 2.5, H, 1, WU, WV);
    g.metal.box(-.9, 0, Z_END - .06, -.8, 2.6, Z_END + .06); g.metal.box(.8, 0, Z_END - .06, .9, 2.6, Z_END + .06); g.metal.box(-.9, 2.5, Z_END - .06, .9, 2.6, Z_END + .06);
    for (const px of [-1.6, -1.45]) g.metal.box(px - .05, H - .25, Z_CELL_BACK, px + .05, H - .15, Z_END);
    for (const z of LAMPS_Z) {
      g.metal.box(-.01, 2.85, z - .01, .01, H, z + .01);
      g.dark.cyl(0, z, 2.62, 2.86, .32, .06, 14);
      g.bulbs.cyl(0, z, 2.6, 2.7, .07, .07, 10);
      g.cones.cyl(0, z, 0.15, 2.62, 1.25, .3, 24);
    }

    /* --- garage --- */
    g.gfloor.qy(-GX, GX, Z_END, Z_GAR_END, 0, true, CU);
    g.concrete.qy(-GX, GX, Z_END, Z_GAR_END, GH, false, CU);
    g.concrete.qx(-GX, Z_END, Z_GAR_END, 0, GH, 1, CU, CU); g.concrete.qx(GX, Z_END, Z_GAR_END, 0, GH, -1, CU, CU);
    g.concrete.qz(Z_END, -GX, -.8, 0, GH, -1, CU, CU); g.concrete.qz(Z_END, .8, GX, 0, GH, -1, CU, CU); g.concrete.qz(Z_END, -.8, .8, 2.5, GH, -1, CU, CU);
    g.concrete.qz(Z_GAR_END, -GX, -3, 0, GH, 1, CU, CU); g.concrete.qz(Z_GAR_END, 3, GX, 0, GH, 1, CU, CU); g.concrete.qz(Z_GAR_END, -3, 3, 3.8, GH, 1, CU, CU);
    g.metal.box(-3.15, 0, Z_GAR_END - .05, -3, 3.9, Z_GAR_END + .12); g.metal.box(3, 0, Z_GAR_END - .05, 3.15, 3.9, Z_GAR_END + .12); g.metal.box(-3.15, 3.8, Z_GAR_END - .05, 3.15, 3.95, Z_GAR_END + .12);
    // parking lines
    for (const x of [-1.75, 1.75]) g.paint.qy(x - .06, x + .06, -22.4, -31.0, .012, true, 1);
    g.paint.qy(-1.75, 1.75, -22.4, -22.52, .012, true, 1);
    // ceiling tubes + wall beacons
    for (const z of [-19.5, -31]) { g.metal.box(-.08, GH - .12, z - .8, .08, GH, z + .8); g.tubes.box(-.05, GH - .16, z - .75, .05, GH - .12, z + .75); }
    for (const [bx, bz] of [[-GX + .02, -24], [GX - .02, -24], [-GX + .02, -32], [GX - .02, -32]]) { const s = Math.sign(bx); g.dark.box(bx, 3.3, bz - .14, bx - s * .14, 3.42, bz + .14); g.beacon.box(bx - s * .02, 3.42, bz - .1, bx - s * .12, 3.6, bz + .1); }
    for (const [x0, z0, x1, z1, h] of CRATES) g.wood.box(x0, h > 1.5 ? 1.1 : 0, z0, x1, h, z1, .9, .9);
    for (const [x, z] of DRUMS) { g.drum.cyl(x, z, 0, .9, .3, .3, 16); g.drum.disk(x, .9, z, .3, 16, true); }

    /* --- tunnel --- */
    g.asphalt.qy(-TW, TW, Z_GAR_END, Z_TUN_END, 0, true, 3);
    g.concrete.qy(-TW, TW, Z_GAR_END, Z_TUN_END, TH, false, 3);
    g.concrete.qx(-TW, Z_GAR_END, Z_TUN_END, 0, TH, 1, CU, CU); g.concrete.qx(TW, Z_GAR_END, Z_TUN_END, 0, TH, -1, CU, CU);
    g.concrete.qz(Z_GAR_END, -TW, -3, 0, TH, -1, CU, CU); g.concrete.qz(Z_GAR_END, 3, TW, 0, TH, -1, CU, CU); g.concrete.qz(Z_GAR_END, -3, 3, 3.95, TH, -1, CU, CU);
    for (let z = -40; z > Z_TUN_END; z -= 6) g.paint.qy(-.07, .07, z, z - 2.6, .012, true, 1);
    for (const z of TUN_LAMPS) {
      const x = -TW + .45;
      g.metal.cyl(x, z, 0, 3.75, .07, .06, 8);
      g.metal.box(x - .05, 3.62, z - .04, x + .95, 3.7, z + .04);
      g.dark.box(x + .7, 3.5, z - .18, x + 1.08, 3.68, z + .18);
      g.tlamp.box(x + .73, 3.46, z - .13, x + 1.05, 3.5, z + .13);
    }
    for (const z of SODIUM) { g.dark.box(TW - .12, 2.6, z - .26, TW, 3.0, z + .26); g.sodium.box(TW - .15, 2.66, z - .2, TW - .11, 2.94, z + .2); }

    /* --- bridge over the chasm --- */
    const ZB0 = Z_TUN_END, ZB1 = BRIDGE_END, RU = 8;
    g.asphalt.qy(-TW, TW, ZB0, ZB1, 0, true, 3);
    for (let z = ZB0 - 4; z > ZB1; z -= 6) g.paint.qy(-.07, .07, z, z - 2.6, .012, true, 1);
    g.concrete.qy(-TW - .3, TW + .3, ZB0, ZB1, -.9, false, 3);
    for (const sd of [-1, 1]) {
      g.concrete.qx(sd * (TW + .3), ZB0, ZB1, -.9, .25, sd, 3, 3);
      g.concrete.box(sd * TW, 0, ZB0, sd * (TW + .3), .25, ZB1, 3, 3);
      for (let z = ZB0 - 1; z > ZB1; z -= 2.5) g.metal.box(sd * (TW + .1), .25, z - .05, sd * (TW + .2), 1.2, z + .05);
      g.metal.box(sd * (TW + .08), 1.1, ZB0, sd * (TW + .22), 1.2, ZB1);
      g.metal.box(sd * (TW + .1), .62, ZB0, sd * (TW + .2), .68, ZB1);
    }
    for (const z of [-212, -268, -318]) g.concrete.box(-2.2, -80, z - 1.5, 2.2, -.9, z + 1.5, 4, 4);
    for (const [sd, z] of BR_LAMPS) {
      const x = sd * (TW + .15);
      g.metal.cyl(x, z, .25, 5.2, .08, .06, 8);
      g.metal.box(x, 5.1, z - .05, x - sd * 1.4, 5.2, z + .05);
      g.dark.box(x - sd * 1.55, 4.95, z - .22, x - sd * 1.05, 5.15, z + .22);
      g.sodium.box(x - sd * 1.5, 4.9, z - .16, x - sd * 1.1, 4.95, z + .16);
    }
    // the chasm: rock faces either side, tunnel portals at both ends
    g.rock.qx(-70, ZB0 + 10, ZB1 - 30, -140, 40, 1, RU, RU); g.rock.qx(70, ZB0 + 10, ZB1 - 30, -140, 40, -1, RU, RU);
    for (const [zz, dir] of [[ZB0, -1], [ZB1 - 4, 1]]) {
      g.rock.qz(zz, -70, -TW, -140, 40, dir, RU, RU); g.rock.qz(zz, TW, 70, -140, 40, dir, RU, RU);
      g.rock.qz(zz, -TW, TW, TH, 40, dir, RU, RU); g.rock.qz(zz, -TW, TW, -140, -.9, dir, RU, RU);
    }
    g.dark.qz(ZB1 - 4.5, -TW, TW, -.9, TH, 1, 4, 4);
    for (const [x, z] of MINES) { g.mine.cyl(x, z, 0, .07, .25, .2, 14); g.mine.disk(x, .07, z, .2, 14, true); g.mineled.box(x - .035, .07, z - .035, x + .035, .1, z + .035); }
    return g;
  }

  function buildDoor() { // local: bottom centre of the door on its hinge line
    const g = new Geo();
    for (let i = 0; i < 7; i++) g.cyl(-.42 + i * .14, 0, 0, 2.38, .022, .022, 6);
    g.box(-DOOR_W, 0, -.03, -DOOR_W + .05, 2.4, .03); g.box(DOOR_W - .05, 0, -.03, DOOR_W, 2.4, .03);
    g.box(-DOOR_W, 2.32, -.035, DOOR_W, 2.4, .035); g.box(-DOOR_W, .06, -.03, DOOR_W, .14, .03); g.box(-DOOR_W, 1.12, -.03, DOOR_W, 1.2, .03);
    g.box(DOOR_W - .14, 1.0, -.06, DOOR_W - .02, 1.26, .06);
    return g;
  }
  function buildGarageDoor() {
    const g = new Geo(), z = Z_GAR_END + .04;
    g.box(-3, 0, z - .03, 3, 3.82, z + .03);
    for (let y = .2; y < 3.8; y += .4) g.box(-3, y, z + .03, 3, y + .05, z + .06);
    return g;
  }
  // truck, local coords: x right, y up, -z forward. z=0 is the back of the cab, the bed runs to z=+2.7
  function buildTruck() {
    const g = { body: new Geo(), trim: new Geo(), seat: new Geo(), bed: new Geo(), lights: new Geo(), tail: new Geo() };
    const b = g.body, m = g.trim;
    m.box(-.85, .45, -3.3, .85, .7, 2.6);                     // chassis
    g.bed.box(-1.0, .7, .02, 1.0, .85, 2.7, 1, 1);              // bed floor
    for (const s of [-1, 1]) b.box(s * .94, .85, .02, s * 1.0, 1.4, 2.7);      // bed sides
    b.box(-1.0, .85, 2.64, 1.0, 1.4, 2.7);                      // tailgate
    m.box(-1.02, 1.36, .02, -.94, 1.44, 2.7); m.box(.94, 1.36, .02, 1.02, 1.44, 2.7); m.box(-1.0, 1.36, 2.62, 1.0, 1.44, 2.72);
    // cab
    b.box(-1.0, .7, -.06, 1.0, 1.55, 0);                        // rear wall (below window)
    b.box(-1.0, 2.35, -.06, 1.0, 2.6, 0);                       // above window
    for (const s of [-1, 1]) {
      b.box(s * .55, 1.55, -.06, s * 1.0, 2.35, 0);            // window pillars
      b.box(s * .94, .7, -1.7, s * 1.0, 1.55, -.06);           // doors
      b.box(s * .94, 1.55, -1.75, s * 1.0, 2.6, -1.62);        // A pillars
      b.box(s * .94, 2.45, -1.7, s * 1.0, 2.6, -.06);          // roof rails
      b.box(s * .62, .85, -3.0, s * 1.06, 1.08, -1.72);        // front fenders
      b.box(s * .66, .7, -3.2, s * 1.0, .95, -2.95);
      b.box(s * 1.0, .7, 1.35, s * 1.12, 1.02, 2.45);          // rear fenders
      m.box(s * .95, .45, -1.75, s * 1.16, .52, 0);            // running boards
    }
    b.box(-1.0, 2.6, -1.75, 1.0, 2.68, .02);                    // roof
    b.box(-1.0, .7, -1.78, 1.0, 1.5, -1.66);                    // firewall / dash
    b.box(-1.0, 1.5, -1.75, 1.0, 1.56, -1.62);
    b.box(-.62, .85, -3.25, .62, 1.5, -1.72);                   // hood
    m.box(-.46, .75, -3.33, .46, 1.46, -3.25);                  // grille
    for (let x = -.38; x < .4; x += .08) g.body.box(x - .012, .8, -3.34, x + .012, 1.42, -3.32);
    m.box(-1.06, .45, -3.48, 1.06, .6, -3.34); m.box(-1.06, .45, 2.72, 1.06, .6, 2.84);   // bumpers
    // seat + steering column
    g.seat.box(-.9, .7, -.95, .9, 1.05, -.3); g.seat.box(-.9, 1.05, -.3, .9, 1.6, -.12);
    m.box(-.48, 1.0, -1.62, -.42, 1.42, -1.25);
    m.cylX(-.6, -.3, 1.42, -1.22, .03, 8);
    // lamps
    for (const s of [-1, 1]) {
      m.box(s * .7, 1.08, -2.95, s * .9, 1.12, -2.75);
      g.lights.cylX(s * .9, s * .7, 1.25, -2.92, .1, 12);
      g.tail.box(s * .86, .92, 2.7, s * .98, 1.04, 2.74);
    }
    return g;
  }
  function buildWheel() {
    const g = { tire: new Geo(), hub: new Geo() };
    g.tire.cylX(-.14, .14, 0, 0, .45, 20);
    g.hub.cylX(-.16, .16, 0, 0, .22, 12);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.hub.box(-.165, Math.cos(a) * .3 - .03, Math.sin(a) * .3 - .03, .165, Math.cos(a) * .3 + .03, Math.sin(a) * .3 + .03); }
    return g;
  }
  const WHEELS = [[-.95, .45, -2.35], [.95, .45, -2.35], [-.95, .45, 1.85], [.95, .45, 1.85]];

  // solid boxes for walking: [x0, x1, z0, z1]
  function buildSolids() {
    const s = [
      [-CW - .3, -CW, Z_BARS, Z_CELL_BACK], [CW, CW + .3, Z_BARS, Z_CELL_BACK], [-CW, CW, Z_CELL_BACK, Z_CELL_BACK + .3],
      [-CW, -DOOR_W, Z_BARS - .05, Z_BARS + .05], [DOOR_W, CW, Z_BARS - .05, Z_BARS + .05],
      [-CW, -1.1, 2.1, 4.5], [1.3, 1.8, 4.22, 4.75],
      [-CW - .3, -CW, Z_END, Z_BARS], [CW, CW + .3, Z_END, Z_BARS],
      [-CW, -.85, Z_END - .25, Z_END + .06], [.85, CW, Z_END - .25, Z_END + .06],
      [-GX, -.85, Z_END - .25, Z_END], [.85, GX, Z_END - .25, Z_END],
      [-GX - .3, -GX, Z_GAR_END, Z_END], [GX, GX + .3, Z_GAR_END, Z_END], [-GX, GX, Z_GAR_END - .3, Z_GAR_END + .1]
    ];
    for (const [x0, z0, x1, z1] of CRATES) s.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
    for (const [x, z] of DRUMS) s.push([x - .3, x + .3, z - .3, z + .3]);
    return s;
  }
  const DOOR_SOLID = [-DOOR_W, DOOR_W, Z_BARS - .05, Z_BARS + .05];
  const TRUCK_SOLID = [-1.18, 1.18, TRUCK_Z0 - 3.5, TRUCK_Z0 + 2.85];

  /* ================= act 2: the basement room, the junction and the sewer ================= */
  const H2 = 3.0;
  const SEWER_MAP = [
    '###########',
    '#S...#...X#',
    '###.##.####',
    '#F..#...#.#',
    '###.#.#.#.#',
    '#...#.#...#',
    '#.###.###.#',
    '#.........#',
    '###########'];
  const CS = 4, SH = 3.4, SX = 30, SZ = -14;
  const MAP_W = SEWER_MAP[0].length, MAP_H = SEWER_MAP.length;
  const walkable = (c, r) => r >= 0 && r < MAP_H && c >= 0 && c < MAP_W && SEWER_MAP[r][c] !== '#';
  const cellX0 = c => SX + c * CS, cellZ0 = r => SZ - r * CS;          // a cell spans x [x0, x0+CS], z [z0-CS, z0]
  const cellC = (c, r) => [SX + c * CS + CS / 2, SZ - r * CS - CS / 2];
  const cellOf = (x, z) => [Math.floor((x - SX) / CS), Math.floor((SZ - z) / CS)];
  const findCell = ch => { for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) if (SEWER_MAP[r][c] === ch) return [c, r]; return null; };
  const S_CELL = findCell('S'), F_CELL = findCell('F'), X_CELL = findCell('X');
  const SEWER_LAMPS = [[1, 1, 'w'], [4, 1, 'n'], [3, 3, 'e'], [3, 5, 'e'], [5, 7, 's'], [7, 3, 'n'], [9, 5, 'e'], [1, 7, 'w'], [7, 7, 's']];
  const lampPos = ([c, r, side]) => {
    const [cx, cz] = cellC(c, r), x0 = cellX0(c), z0 = cellZ0(r);
    if (side === 'w') return [x0 + .16, 2.55, cz]; if (side === 'e') return [x0 + CS - .16, 2.55, cz];
    if (side === 'n') return [cx, 2.55, z0 - .16]; return [cx, 2.55, z0 - CS + .16];
  };
  // flashlight on a crate at the far end of its dead-end, ladder on the exit cell's east wall
  const FLASH_POS = [cellX0(F_CELL[0]) + .65, .78, cellC(...F_CELL)[1]];
  const LADDER_X = cellX0(X_CELL[0]) + CS, LADDER_Z = cellC(...X_CELL)[1];
  const SEWER_DOOR = [-8.75, -9.1];                // in the junction, left end

  function buildWorld2() {
    const g = {};
    for (const k of ['floor', 'conc', 'wall2', 'brick', 'water', 'sceil', 'metal', 'dark', 'wood', 'cloth', 'drum', 'rust', 'bulbs2', 'sign', 'lamps', 'shaft', 'stripe', 'sky'])
      g[k] = new Geo();
    const CU = 2.6;
    /* --- room you wake up in --- */
    g.floor.qy(-3, 3, 0, 6, 0, true, 2); g.conc.qy(-3, 3, 0, 6, H2, false, 2.6);
    g.wall2.qx(-3, 0, 6, 0, H2, 1, CU, CU); g.wall2.qx(3, 0, 6, 0, H2, -1, CU, CU); g.wall2.qz(6, -3, 3, 0, H2, -1, CU, CU);
    g.wall2.qz(0, -3, -.8, 0, H2, 1, CU, CU); g.wall2.qz(0, .8, 3, 0, H2, 1, CU, CU); g.wall2.qz(0, -.8, .8, 2.3, H2, 1, CU, CU);
    g.metal.box(-.9, 0, -.06, -.8, 2.35, .06); g.metal.box(.8, 0, -.06, .9, 2.35, .06); g.metal.box(-.9, 2.28, -.06, .9, 2.38, .06);
    // the door behind you, buried in junk
    g.metal.box(-.72, 0, 5.92, -.6, 2.32, 6); g.metal.box(.6, 0, 5.92, .72, 2.32, 6); g.metal.box(-.72, 2.2, 5.92, .72, 2.32, 6);
    g.rust.box(-.6, 0, 5.95, .6, 2.2, 5.99);
    g.wood.boxR(0, 1.0, 5.86, 1.05, .09, .03, 0, 0, .55); g.wood.boxR(0, 1.55, 5.84, 1.05, .09, .03, 0, 0, -.5);
    g.wood.boxR(0, .55, 5.82, .95, .08, .03, 0, 0, .12); g.wood.boxR(.05, 1.95, 5.8, .9, .08, .03, 0, 0, .25);
    g.wood.box(-1.45, 0, 5.0, -.55, .9, 5.9, .9, .9); g.wood.box(-1.35, .9, 5.15, -.62, 1.62, 5.85, .9, .9); g.wood.box(-1.2, 1.62, 5.3, -.75, 2.0, 5.8, .9, .9);
    g.wood.box(.42, 0, 5.18, 1.22, .82, 5.95, .9, .9);
    g.drum.cyl(1.6, 5.35, 0, .9, .3, .3, 14); g.drum.disk(1.6, .9, 5.35, .3, 14, true);
    g.cloth.boxR(-.05, 1.0, 5.5, .5, 1.0, .1, -.25, .1, .1);
    g.metal.boxR(.8, 1.1, 5.55, .6, .03, .03, .2, .5, .9); g.wood.boxR(.9, .95, 5.05, .26, .03, .26, .9, .4, .2);
    g.dark.cylX(1.9, 2.2, .45, 4.6, .45, 16);
    // where you woke up
    g.cloth.box(-.65, 0, 3.4, .75, .16, 5.15); g.cloth.box(-.5, .16, 4.75, .55, .26, 5.1);
    g.metal.box(-.01, 2.62, 2.99, .01, H2, 3.01); g.dark.cyl(0, 3, 2.56, 2.66, .07, .03, 10); g.bulbs2.cyl(0, 3, 2.46, 2.56, .055, .055, 10);
    for (const [x, z, s] of [[-2.2, 1.2, .25], [2.4, 2.1, .3], [-1.9, .6, .18], [1.6, .8, .2], [2.5, 4.0, .22]]) g.conc.boxR(x, s * .4, z, s, s * .4, s * .7, 0, x * 2, 0);
    g.wood.boxR(-2.3, .06, 3.2, .9, .03, .1, 0, .7, 0); g.wood.boxR(2.1, .05, 1.5, .7, .03, .09, 0, -.4, 0);
    /* --- corridor --- */
    g.floor.qy(-1, 1, 0, -8, 0, true, 2); g.conc.qy(-1, 1, 0, -8, H2, false, 2.6);
    g.wall2.qx(-1, 0, -8, 0, H2, 1, CU, CU); g.wall2.qx(1, 0, -8, 0, H2, -1, CU, CU);
    g.dark.box(-1, 2.2, -4.18, -.88, 2.42, -3.82); g.bulbs2.box(-.9, 2.24, -4.12, -.86, 2.38, -3.88);
    for (const px of [.8, .66]) g.metal.cylZ(0, -10.2, px, 2.75, .05, 8);
    /* --- junction: left to the sewer, right is blocked --- */
    g.floor.qy(-9, 9, -8, -10.2, 0, true, 2); g.conc.qy(-9, 9, -8, -10.2, H2, false, 2.6);
    g.wall2.qz(-10.2, -9, 9, 0, H2, 1, CU, CU);
    g.wall2.qz(-8, -9, -1, 0, H2, -1, CU, CU); g.wall2.qz(-8, 1, 9, 0, H2, -1, CU, CU);
    g.wall2.qx(9, -8, -10.2, 0, H2, -1, CU, CU); g.wall2.qx(-9, -8, -10.2, 0, H2, 1, CU, CU);
    g.metal.box(-9, 0, -9.82, -8.9, 2.32, -9.7); g.metal.box(-9, 0, -8.5, -8.9, 2.32, -8.38); g.metal.box(-9, 2.22, -9.82, -8.9, 2.32, -8.38);
    g.rust.box(-8.99, 0, -9.7, -8.95, 2.22, -8.5);
    g.dark.box(-8.96, 1.0, -8.66, -8.88, 1.16, -8.56);
    g.sign.quad([-8.93, 2.42, -8.55], [-8.93, 2.42, -9.65], [-8.93, 2.8, -9.65], [-8.93, 2.8, -8.55], [1, 0, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    g.dark.box(-8.98, 2.86, -9.2, -8.86, 3.0, -9.0); g.bulbs2.box(-8.88, 2.88, -9.17, -8.84, 2.98, -9.03);
    // junk wall on the right
    g.wood.box(2.4, 0, -10.15, 3.45, 1.15, -9.0, .9, .9); g.wood.box(2.55, 0, -9.0, 3.6, .95, -8.05, .9, .9);
    g.wood.box(2.65, 1.15, -10.05, 3.5, 1.95, -9.15, .9, .9); g.wood.box(2.75, .95, -8.9, 3.45, 1.6, -8.15, .9, .9);
    g.drum.cyl(3.95, -9.6, 0, .9, .3, .3, 14); g.drum.disk(3.95, .9, -9.6, .3, 14, true); g.drum.cyl(4.0, -8.6, 0, .9, .3, .3, 14); g.drum.disk(4.0, .9, -8.6, .3, 14, true);
    g.wood.boxR(3.0, 1.35, -8.55, .95, .08, .05, 0, .3, .6); g.wood.boxR(3.1, 2.15, -9.4, 1.0, .07, .04, .2, 0, -.4); g.wood.boxR(2.9, 2.4, -8.6, .8, .07, .04, .5, .2, .9);
    g.cloth.boxR(3.3, 1.0, -8.8, .6, .9, .08, .2, -.6, .2); g.metal.boxR(2.95, 1.05, -9.1, 1.1, .04, .04, .4, .8, 0);
    g.stripe.box(2.3, 2.3, -10.15, 2.36, 2.5, -8.05);
    /* --- sewer --- */
    const BU = 2.4;
    for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) {
      if (!walkable(c, r)) continue;
      const x0 = cellX0(c), x1 = x0 + CS, z1 = cellZ0(r), z0 = z1 - CS;   // z0 < z1
      g.water.qy(x0, x1, z0, z1, .05, true, 4);
      const isX = c === X_CELL[0] && r === X_CELL[1];
      if (isX) {   // hole for the exit shaft by the ladder
        g.sceil.qy(x0, x1 - 1.4, z0, z1, SH, false, 3); g.sceil.qy(x1 - 1.4, x1, z0, LADDER_Z - .7, SH, false, 3); g.sceil.qy(x1 - 1.4, x1, LADDER_Z + .7, z1, SH, false, 3);
        g.shaft.qx(x1 - 1.4, LADDER_Z - .7, LADDER_Z + .7, SH, SH + 4, 1, 2, 2); g.shaft.qz(LADDER_Z - .7, x1 - 1.4, x1, SH, SH + 4, 1, 2, 2); g.shaft.qz(LADDER_Z + .7, x1 - 1.4, x1, SH, SH + 4, -1, 2, 2);
        g.brick.qx(x1, LADDER_Z - .7, LADDER_Z + .7, SH, SH + 4, -1, BU, BU);
        g.sky.qy(x1 - 1.4, x1, LADDER_Z - .7, LADDER_Z + .7, SH + 4, false, 1);
      } else g.sceil.qy(x0, x1, z0, z1, SH, false, 3);
      // walls where the neighbour is solid; a pipe runs along each one
      if (!walkable(c, r - 1)) { g.brick.qz(z1, x0, x1, 0, SH, -1, BU, BU); g.rust.cylX(x0, x1, 2.85, z1 - .22, .1, 10); }
      if (!walkable(c, r + 1)) { g.brick.qz(z0, x0, x1, 0, SH, 1, BU, BU); g.metal.cylX(x0, x1, .45, z0 + .2, .07, 8); }
      if (!walkable(c - 1, r)) { g.brick.qx(x0, z0, z1, 0, SH, 1, BU, BU); g.metal.cylZ(z0, z1, x0 + .2, 2.6, .08, 8); }
      if (!walkable(c + 1, r)) { g.brick.qx(x1, z0, z1, 0, SH, -1, BU, BU); g.rust.cylZ(z0, z1, x1 - .22, .55, .1, 10); }
      // ceiling ribs between connected cells
      if (walkable(c, r - 1)) g.conc.box(x0, SH - .25, z1 - .2, x1, SH, z1 + .2, 2, 2);
      if (walkable(c - 1, r)) g.conc.box(x0 - .2, SH - .25, z0, x0 + .2, SH, z1, 2, 2);
    }
    // entrance door (closed behind you)
    { const [cx, cz] = cellC(...S_CELL), x0 = cellX0(S_CELL[0]);
      g.rust.box(x0 + .01, 0, cz - .6, x0 + .06, 2.2, cz + .6); g.metal.box(x0, 2.2, cz - .7, x0 + .1, 2.3, cz + .7); g.metal.box(x0, 0, cz - .7, x0 + .1, 2.3, cz - .6); g.metal.box(x0, 0, cz + .6, x0 + .1, 2.3, cz + .7); }
    // crate the flashlight sits on
    g.wood.box(FLASH_POS[0] - .4, 0, FLASH_POS[2] - .45, FLASH_POS[0] + .4, .7, FLASH_POS[2] + .45, .9, .9);
    // ladder up to the manhole
    for (const s of [-.28, .28]) g.metal.box(LADDER_X - .2, 0, LADDER_Z + s - .03, LADDER_X - .14, SH + 3.6, LADDER_Z + s + .03);
    for (let y = .3; y < SH + 3.5; y += .32) g.metal.box(LADDER_X - .2, y, LADDER_Z - .28, LADDER_X - .14, y + .04, LADDER_Z + .28);
    // caged wall lamps
    for (const L of SEWER_LAMPS) { const [x, y, z] = lampPos(L); g.dark.box(x - .1, y + .12, z - .1, x + .1, y + .16, z + .1); g.lamps.box(x - .05, y - .06, z - .05, x + .05, y + .1, z + .05); }
    return g;
  }

  function buildFlashlight() {   // small torch model, local coords, pointing +x
    const g = { body: new Geo(), lens: new Geo() };
    g.body.cylX(-.13, .1, 0, 0, .028, 12); g.body.cylX(.1, .16, 0, 0, .042, 12);
    g.lens.cylX(.16, .165, 0, 0, .036, 12);
    return g;
  }

  // solid boxes outside the sewer: [x0, x1, z0, z1]
  function buildSolids2() {
    return [
      [-3.3, -3, 0, 6], [3, 3.3, 0, 6], [-3, 3, 6, 6.3], [-3, 3, 5.0, 6],        // room walls + the junk at the door
      [-3, -.85, -.3, .05], [.85, 3, -.3, .05],
      [-1.3, -1, -8, 0], [1, 1.3, -8, 0],
      [-9, -1, -8, -7.7], [1, 9, -8, -7.7], [-9, 9, -10.5, -10.2], [-9.3, -9, -10.2, -8], [9, 9.3, -10.2, -8],
      [2.3, 4.5, -10.2, -8]                                                       // junk wall: can't go right for now
    ];
  }
  // line of sight through the sewer grid
  function sewerLOS(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / .35);
    for (let i = 1; i < n; i++) { const k = i / n, [c, r] = cellOf(ax + (bx - ax) * k, az + (bz - az) * k); if (!walkable(c, r)) return false; }
    return true;
  }
  function sewerBFS(c0, r0) {
    const dist = new Array(MAP_W * MAP_H).fill(-1), q = [[c0, r0]]; dist[r0 * MAP_W + c0] = 0;
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (walkable(nc, nr) && dist[nr * MAP_W + nc] < 0) { dist[nr * MAP_W + nc] = dist[r * MAP_W + c] + 1; q.push([nc, nr]); }
      }
    }
    return dist;
  }

  /* ================= GL helpers ================= */
  function compile(gl, vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function meshFromGeo(gl, g) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (loc, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    buf(0, g.p, 3); buf(1, g.n, 3); buf(2, g.uv, 2);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(g.i), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: g.i.length, type: gl.UNSIGNED_INT };
  }
  function texFromCanvas(gl, c, aniso) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  }

  /* ================= skeleton / creature ================= */
  // armature space is Z-up; the mesh is Y-up: mesh = (x, z, -y)
  const C = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
  const Cinv = M4.invert(C);

  function makeSkeleton(meta) {
    const joints = meta.skeleton.map(s => ({ name: s.name.replace(/_\d+$/, ''), parent: s.parent, t: s.t, r: s.r, s: s.s }));
    const byName = {}; joints.forEach((j, i) => { byName[j.name] = i; });
    const restG = [];
    joints.forEach((j, i) => { const L = M4.trs(j.t, j.r, j.s); restG[i] = j.parent < 0 ? L : M4.mul(restG[j.parent], L); });
    const invRest = restG.map(M4.invert);
    const restMeshPos = restG.map(G => M4.xform(C, [G[12], G[13], G[14]]));
    return { joints, byName, invRest, restMeshPos, G: [], skin: new Float32Array(joints.length * 16) };
  }
  function poseSkeleton(sk, deltas) {
    const { joints, G } = sk;
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i], d = deltas[j.name];
      const L = M4.trs(j.t, d ? Q.mul(j.r, d) : j.r, j.s);
      G[i] = j.parent < 0 ? L : M4.mul(G[j.parent], L);
      const S = M4.mul(M4.mul(C, G[i]), M4.mul(sk.invRest[i], Cinv));
      sk.skin.set(S, i * 16);
    }
  }
  const jointMeshPos = (sk, name) => { const G = sk.G[sk.byName[name]]; return M4.xform(C, [G[12], G[13], G[14]]); };

  /* ================= procedural animation ================= */
  // rotation signs per joint axis, found by rendering test poses
  const AX = { hip: -1, knee: -1, foot: 1, spine: 1, armSwingL: -1, armSwingR: 1, armDownL: 1, armDownR: 1, elbowL: 1, elbowR: -1, headPitch: 1, tilt: 1, neckYaw: 1 };
  function walkPose(walk, ph, look, lookPitch, talk, t) {
    const d = {};
    const s = Math.sin(ph), c = Math.cos(ph);
    const hipA = 26 * D * walk, kneeA = 52 * D * walk;
    const lHip = s * hipA, rHip = -s * hipA;
    const lKnee = (6 * D + Math.max(0, c) ** 1.4 * kneeA), rKnee = (6 * D + Math.max(0, -c) ** 1.4 * kneeA);
    d.LeftUpLeg = Q.euler(-lHip * AX.hip, 0, 0); d.RightUpLeg = Q.euler(-rHip * AX.hip, 0, 0);
    d.LeftLeg = Q.euler(lKnee * AX.knee, 0, 0); d.RightLeg = Q.euler(rKnee * AX.knee, 0, 0);
    d.LeftFoot = Q.euler((lHip - lKnee) * .5 * AX.foot, 0, 0); d.RightFoot = Q.euler((rHip - rKnee) * .5 * AX.foot, 0, 0);
    const breathe = Math.sin(t * 1.7) * 1.2 * D;
    const hunch = (9 + 6 * look) * D;
    d.Spine = Q.euler(hunch * .4 * AX.spine + breathe, s * 4 * D * walk, -c * 2.5 * D * walk);
    d.Spine1 = Q.euler(hunch * .3 * AX.spine, s * 3 * D * walk, 0);
    d.Spine2 = Q.euler(hunch * .3 * AX.spine - breathe * .5, 0, 0);
    const armDown = 74 * D, swing = 16 * D * walk, twitch = talk * Math.sin(t * 23) * 3 * D;
    d.LeftArm = Q.euler(armDown * AX.armDownL, 0, (s * swing + twitch) * AX.armSwingL);
    d.RightArm = Q.euler(armDown * AX.armDownR, 0, (-s * swing - twitch) * AX.armSwingR);
    d.LeftForeArm = Q.euler(0, 0, (14 + 8 * Math.max(0, s) * walk) * D * AX.elbowL);
    d.RightForeArm = Q.euler(0, 0, (14 + 8 * Math.max(0, -s) * walk) * D * AX.elbowR);
    const bob = Math.sin(ph * 2) * 2 * D * walk;
    const tilt = look * (17 * D + Math.sin(t * .9) * 2 * D) + talk * Math.sin(t * 9) * 2 * D;
    const nod = talk * (Math.sin(t * 13) * 3 + Math.sin(t * 5.3) * 2) * D;
    d.Neck = Q.euler((lookPitch * .45 + bob) * AX.headPitch, 0, tilt * .4 * AX.tilt);
    d.Head = Q.euler((lookPitch * .55 + nod) * AX.headPitch, 0, tilt * .6 * AX.tilt);
    return d;
  }
  // seated pose (driver / passenger). angles in radians
  function sitPose(o) {
    const d = {};
    d.LeftUpLeg = Q.euler(o.hip, 0, 0); d.RightUpLeg = Q.euler(o.hip, 0, 0);
    d.LeftLeg = Q.euler(-o.knee, 0, 0); d.RightLeg = Q.euler(-o.knee, 0, 0);
    d.LeftFoot = Q.euler(o.foot || 0, 0, 0); d.RightFoot = Q.euler(o.foot || 0, 0, 0);
    const br = Math.sin(o.t * 1.7) * 1.2 * D;
    d.Spine = Q.euler(o.hunch * .4 + br, 0, 0); d.Spine1 = Q.euler(o.hunch * .3, 0, 0); d.Spine2 = Q.euler(o.hunch * .3 - br * .5, 0, 0);
    const lf = o.armFwdL !== undefined ? o.armFwdL : o.armFwd, rf = o.armFwdR !== undefined ? o.armFwdR : o.armFwd;
    d.LeftArm = Q.mul(Q.aa(0, 0, 1, lf), Q.aa(1, 0, 0, o.armDown));
    d.RightArm = Q.mul(Q.aa(0, 0, 1, -rf), Q.aa(1, 0, 0, o.armDown));
    d.LeftForeArm = Q.euler(0, 0, o.elbow); d.RightForeArm = Q.euler(0, 0, -o.elbow);
    const talk = o.talk || 0, nod = talk * (Math.sin(o.t * 13) * 3 + Math.sin(o.t * 5.3) * 2) * D;
    const yaw = (o.neckYaw || 0) * AX.neckYaw;
    d.Neck = Q.euler((o.headPitch || 0) * .45, yaw * .5, (o.tilt || 0) * .4);
    d.Head = Q.euler((o.headPitch || 0) * .55 + nod, yaw * .5, (o.tilt || 0) * .6);
    return d;
  }

  /* ================= audio (Web Audio extras) ================= */
  function makeAudio(getAC, sfxOn) {
    const ac = getAC && getAC();
    const none = () => {};
    if (!ac) return { step: none, pstep: none, setHum: none, clang: none, crash: none, thud: none, siren: none, engine: none, boom: none, ring: none, growl: none, clack: none, screech: none, scream: none, water: none, pickup: none, creak: none, splash: none, roar: none, rumble: none, lock: none, jump: none, land: none, glass: none, click: none, buzz: none, grind: none, scratch: none, squeal: none, charge: none, zap: none, snore: none, stop: none };
    const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
    out.gain.setTargetAtTime(1, ac.currentTime, 1.2);
    const sfx = ac.createGain(); sfx.connect(out);
    const len = ac.sampleRate * 2, nb = ac.createBuffer(1, len, ac.sampleRate), ch = nb.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
    const ng = ac.createGain(); ng.gain.value = .22;
    noise.connect(lp); lp.connect(ng); ng.connect(out); noise.start();
    const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 60;
    const hf = ac.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 120; hf.Q.value = 6;
    const hg = ac.createGain(); hg.gain.value = .02;
    hum.connect(hf); hf.connect(hg); hg.connect(out); hum.start();
    // siren: two detuned saws through a band-pass, pitch swept every frame
    const sg = ac.createGain(); sg.gain.value = 0; sg.connect(sfx);
    const sbp = ac.createBiquadFilter(); sbp.type = 'bandpass'; sbp.Q.value = 1.2; sbp.frequency.value = 900; sbp.connect(sg);
    const so1 = ac.createOscillator(), so2 = ac.createOscillator(); so1.type = 'sawtooth'; so2.type = 'square'; so2.detune.value = 9;
    so1.connect(sbp); so2.connect(sbp); so1.start(); so2.start();
    // engine
    const eg = ac.createGain(); eg.gain.value = 0; eg.connect(sfx);
    const elp = ac.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 180; elp.connect(eg);
    const eo1 = ac.createOscillator(), eo2 = ac.createOscillator(); eo1.type = 'sawtooth'; eo2.type = 'square'; eo1.frequency.value = 34; eo2.frequency.value = 68.5;
    const e2g = ac.createGain(); e2g.gain.value = .35; eo1.connect(elp); eo2.connect(e2g); e2g.connect(elp); eo1.start(); eo2.start();
    const burst = (t, dur, freq, type, vol, q) => {
      const src = ac.createBufferSource(); src.buffer = nb;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(sfx); src.start(t, Math.random()); src.stop(t + dur + .02);
    };
    const tone = (t, f0, f1, dur, vol, type = 'sine') => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(sfx); o.start(t); o.stop(t + dur + .02);
    };
    // sewer water: band-passed noise, plus the odd drip
    const wsrc = ac.createBufferSource(); wsrc.buffer = nb; wsrc.loop = true;
    const wbp = ac.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 700; wbp.Q.value = .7;
    const wg = ac.createGain(); wg.gain.value = 0; wsrc.connect(wbp); wbp.connect(wg); wg.connect(out); wsrc.start();
    let waterLevel = 0, nextDrip = 0;
    // high ringing after the blast
    const ringO = ac.createOscillator(), ringG = ac.createGain(); ringO.frequency.value = 3350; ringG.gain.value = 0; ringO.connect(ringG); ringG.connect(out); ringO.start();
    const api = {
      step(vol) { if (!sfxOn()) return; const t = ac.currentTime; burst(t, .32, 260 + Math.random() * 80, 'lowpass', vol); tone(t, 70, 38, .2, vol * .9); },
      pstep(vol) { if (!sfxOn()) return; const t = ac.currentTime; burst(t, .16, 900 + Math.random() * 300, 'lowpass', vol * .6); tone(t, 110, 60, .1, vol * .4); },
      setHum(v) { hg.gain.setTargetAtTime(.012 + v * .03, ac.currentTime, .03); },
      clang(power) {
        if (!sfxOn()) return; const t = ac.currentTime;
        for (const [f, d] of [[180, 1.1], [437, .9], [712, .7], [1093, .55], [1590, .4], [2310, .3]]) tone(t, f * (1 + Math.random() * .02), f * .985, d * (.6 + power * .5), .09 * power, 'sine');
        burst(t, .12, 2500, 'highpass', .35 * power); tone(t, 90, 45, .25, .5 * power);
      },
      crash() {
        if (!sfxOn()) return; const t = ac.currentTime;
        api.clang(1.4); burst(t, .9, 700, 'lowpass', .7); setTimeout(() => { const t2 = ac.currentTime; burst(t2, .6, 400, 'lowpass', .8); tone(t2, 80, 30, .5, .9); for (const f of [260, 610, 990]) tone(t2, f, f * .98, .5, .07); }, 520);
      },
      thud() { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 90, 40, .3, .7); burst(t, .3, 300, 'lowpass', .5); },
      siren(level, t) {
        const on = sfxOn() ? level : 0, now = ac.currentTime;
        sg.gain.setTargetAtTime(on * .07, now, .2);
        const f = 620 + 520 * (.5 + .5 * Math.sin(t * Math.PI * 2 / 2.4));
        so1.frequency.setTargetAtTime(f, now, .02); so2.frequency.setTargetAtTime(f * 1.005, now, .02); sbp.frequency.setTargetAtTime(f * 1.4, now, .05);
      },
      engine(level, rpm) {
        const now = ac.currentTime;
        eg.gain.setTargetAtTime(sfxOn() ? level * .32 : 0, now, .15);
        eo1.frequency.setTargetAtTime(30 + rpm * 38, now, .2); eo2.frequency.setTargetAtTime(61 + rpm * 77, now, .2); elp.frequency.setTargetAtTime(160 + rpm * 300, now, .2);
      },
      boom() {
        if (!sfxOn()) return; const t = ac.currentTime;
        burst(t, 2.6, 380, 'lowpass', 1.6); burst(t, 1.2, 1800, 'lowpass', .9); tone(t, 90, 22, 1.8, 1.6); tone(t, 55, 18, 2.4, 1.2, 'triangle');
        for (let k = 0; k < 14; k++) burst(t + .1 + Math.random() * 1.4, .12, 1200 + Math.random() * 3000, 'bandpass', .25 + Math.random() * .3, 2);
      },
      ring(level) { ringG.gain.setTargetAtTime(level * .045, ac.currentTime, .6); },
      growl(vol) {
        if (!sfxOn() || vol < .02) return; const t = ac.currentTime;
        const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(62 + Math.random() * 18, t); o.frequency.linearRampToValueAtTime(48, t + 1.1);
        lfo.frequency.value = 19; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
        f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * .55, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + 1.25);
        o.connect(f); f.connect(g); g.connect(sfx); o.start(t); lfo.start(t); o.stop(t + 1.3); lfo.stop(t + 1.3);
        burst(t, 1.0, 260, 'lowpass', vol * .4);
      },
      clack(vol) { if (!sfxOn() || vol < .02) return; const t = ac.currentTime; burst(t, .05, 3200, 'highpass', vol * .5); burst(t + .05, .04, 2600, 'highpass', vol * .35); tone(t, 140, 60, .12, vol * .6); },
      splash(vol) { if (!sfxOn()) return; const t = ac.currentTime; burst(t, .22, 1500 + Math.random() * 600, 'bandpass', vol * .5, 1.5); },
      screech() {
        if (!sfxOn()) return; const t = ac.currentTime;
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(1500, t + .35); o.frequency.exponentialRampToValueAtTime(700, t + 1.3);
        f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
        o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.45); burst(t, 1.2, 2400, 'bandpass', .5, 1.2);
      },
      scream() {
        const t = ac.currentTime;
        for (const [f0, f1, ty] of [[220, 900, 'sawtooth'], [330, 1300, 'square'], [110, 400, 'sawtooth']]) {
          const o = ac.createOscillator(), g = ac.createGain(); o.type = ty; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + .25); o.frequency.linearRampToValueAtTime(f1 * .8, t + 2.2);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .04); g.gain.setValueAtTime(.22, t + 1.8); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
          o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 2.5);
        }
        burst(t, 2.2, 2000, 'bandpass', 1.0, .8); tone(t, 80, 30, .8, 1.2);
      },
      water(level) {
        waterLevel = level; wg.gain.setTargetAtTime(level * .05, ac.currentTime, .5);
        const t = ac.currentTime;
        if (level > .1 && t > nextDrip) { nextDrip = t + .4 + Math.random() * 2.2; const f = 900 + Math.random() * 1400; tone(t, f, f * .55, .09, .05 * level); }
      },
      pickup() { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 1500, 1200, .05, .15, 'square'); tone(t + .07, 2100, 1900, .05, .1, 'square'); },
      roar(vol = 1) {
        if (!sfxOn()) return; const t = ac.currentTime;
        for (const [f0, ty, gv] of [[70, 'sawtooth', .5], [104, 'square', .22], [52, 'sawtooth', .4]]) {
          const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
          o.type = ty; o.frequency.setValueAtTime(f0 * 1.4, t); o.frequency.linearRampToValueAtTime(f0, t + .4); o.frequency.linearRampToValueAtTime(f0 * .8, t + 1.9);
          lfo.frequency.value = 23; lg.gain.value = f0 * .25; lfo.connect(lg); lg.connect(o.frequency);
          f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gv * vol, t + .08); g.gain.setValueAtTime(gv * vol, t + 1.4); g.gain.exponentialRampToValueAtTime(.0001, t + 2.1);
          o.connect(f); f.connect(g); g.connect(sfx); o.start(t); lfo.start(t); o.stop(t + 2.2); lfo.stop(t + 2.2);
        }
        burst(t, 1.9, 700, 'bandpass', .55 * vol, .7);
      },
      rumble() { if (!sfxOn()) return; const t = ac.currentTime; burst(t, 2.2, 120, 'lowpass', 1.2); tone(t, 45, 30, 2.0, .7, 'triangle'); },
      lock() { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 160, 80, .18, .6); burst(t, .08, 2500, 'highpass', .4); burst(t + .32, .05, 3200, 'highpass', .35); tone(t + .32, 900, 700, .06, .2, 'square'); },
      jump() { if (!sfxOn()) return; const t = ac.currentTime; burst(t, .18, 900, 'bandpass', .2, 1); },
      land(v = 1) { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 100, 45, .18, .5 * v); burst(t, .15, 500, 'lowpass', .4 * v); },
      glass() {
        if (!sfxOn()) return; const t = ac.currentTime;
        burst(t, .5, 3500, 'highpass', .9); burst(t, .25, 1200, 'bandpass', .6, 1.5);
        for (let k = 0; k < 16; k++) { const tt = t + .04 + Math.random() * .9, f = 2500 + Math.random() * 4500; tone(tt, f, f * .97, .12 + Math.random() * .2, .05 + Math.random() * .06); }
      },
      click() { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 1900, 1400, .03, .3, 'square'); burst(t, .04, 3000, 'highpass', .3); tone(t + .05, 180, 120, .08, .3); },
      buzz() { if (!sfxOn()) return; const t = ac.currentTime; tone(t, 110, 108, .45, .22, 'sawtooth'); tone(t, 220, 216, .45, .1, 'square'); },
      grind(dur = 2.6) {
        if (!sfxOn()) return; const t = ac.currentTime;
        const src = ac.createBufferSource(); src.buffer = nb; src.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(520, t + dur); f.Q.value = 2.5;
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55, t + .15); g.gain.setValueAtTime(.55, t + dur - .2); g.gain.linearRampToValueAtTime(0, t + dur);
        src.connect(f); f.connect(g); g.connect(sfx); src.start(t); src.stop(t + dur + .05);
        for (let k = 0; k < dur * 6; k++) burst(t + k / 6 + Math.random() * .08, .06, 1800, 'bandpass', .12, 3);
        tone(t + dur - .1, 120, 60, .3, .5); burst(t + dur - .1, .25, 600, 'lowpass', .5);
      },
      scratch(vol = .5) { if (!sfxOn()) return; const t = ac.currentTime; for (let k = 0; k < 4; k++) burst(t + k * .09 + Math.random() * .04, .08, 2600 + Math.random() * 1500, 'bandpass', .25 * vol, 4); },
      squeal(vol = 1) {
        if (!sfxOn()) return; const t = ac.currentTime;
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth';
        const f0 = 700 + Math.random() * 300; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + .12); o.frequency.exponentialRampToValueAtTime(f0 * .9, t + .45);
        f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 3; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3 * vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
        o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + .55);
      },
      charge(k) {
        if (!sfxOn()) return; const t = ac.currentTime, f = 180 + k * 110;
        tone(t, f, f * 2.2, .55, .18, 'sawtooth'); tone(t, f * 1.5, f * 3.1, .5, .08, 'square'); burst(t, .06, 2500, 'highpass', .3); tone(t, 90, 60, .2, .4);
      },
      zap() {
        if (!sfxOn()) return; const t = ac.currentTime;
        for (const [f0, f1, ty, v] of [[1800, 220, 'sawtooth', .35], [900, 110, 'square', .25], [3200, 600, 'sine', .2]]) tone(t, f0, f1, 1.3, v, ty);
        burst(t, 1.4, 2200, 'bandpass', .7, .8); burst(t + .05, 1.6, 400, 'lowpass', 1.0);
      },
      snore(vol = .5) {
        if (!sfxOn() || vol < .02) return; const t = ac.currentTime;
        const src = ac.createBufferSource(); src.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(700, t + .8);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35 * vol, t + .5); g.gain.linearRampToValueAtTime(0, t + 1.3);
        src.connect(f); f.connect(g); g.connect(sfx); src.start(t, Math.random()); src.stop(t + 1.4);
        const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.linearRampToValueAtTime(70, t + 1.0);
        const of = ac.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 240; og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.12 * vol, t + .5); og.gain.linearRampToValueAtTime(0, t + 1.3);
        o.connect(of); of.connect(og); og.connect(sfx); o.start(t); o.stop(t + 1.4);
      },
      creak() { if (!sfxOn()) return; const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(140, t + .9); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 8; g.gain.setValueAtTime(.0, t); g.gain.linearRampToValueAtTime(.3, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + 1.0); o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 1.05); },
      stop() { out.gain.setTargetAtTime(0, ac.currentTime, .3); setTimeout(() => { try { noise.stop(); hum.stop(); so1.stop(); so2.stop(); eo1.stop(); eo2.stop(); wsrc.stop(); ringO.stop(); out.disconnect(); } catch (e) {} }, 1500); }
    };
    return api;
  }

  /* ================= HUD (joystick, action button, objective, end card) ================= */
  const HUD_CSS = `
  .c1-hud{position:absolute;inset:0;pointer-events:none;touch-action:none;font-family:'Barlow Condensed','Arial Narrow',system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .c1-obj{position:absolute;left:50%;top:clamp(14px,3vh,28px);transform:translateX(-50%);font-family:'Luckiest Guy','Impact',sans-serif;font-size:clamp(18px,2.6vw,30px);letter-spacing:.06em;color:#f1e8d8;-webkit-text-stroke:.08em #140a05;paint-order:stroke fill;text-shadow:0 .07em 0 #140a05;white-space:nowrap;opacity:0;transition:opacity .5s}
  .c1-obj.show{opacity:1}
  .c1-obj.alarm{color:#ff4a3a;animation:c1blink .8s steps(2) infinite}
  @keyframes c1blink{50%{opacity:.35}}
  .c1-zone{position:absolute;left:0;bottom:0;width:46%;height:62%;pointer-events:none;touch-action:none}
  .c1-zone.on{pointer-events:auto}
  .c1-joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(241,232,216,.35);background:radial-gradient(circle,rgba(0,0,0,.15),rgba(0,0,0,.35));opacity:0;transition:opacity .4s}
  .c1-zone.on .c1-joy{opacity:.85}
  .c1-thumb{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(241,232,216,.75);box-shadow:0 2px 0 #140a05,0 0 0 3px rgba(20,10,5,.6)}
  .c1-act{position:absolute;right:clamp(18px,5vw,56px);bottom:clamp(24px,8vh,70px);width:clamp(88px,11vw,112px);height:clamp(88px,11vw,112px);border-radius:50%;border:3px solid #140a05;background:#ff9443;color:#140a05;font-family:'Luckiest Guy','Impact',sans-serif;font-size:clamp(20px,2.4vw,26px);letter-spacing:.04em;line-height:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:0 6px 0 #140a05,0 0 30px rgba(255,148,67,.45);pointer-events:none;opacity:0;transform:scale(.6);transition:opacity .2s,transform .25s cubic-bezier(.3,1.6,.5,1);cursor:pointer;touch-action:none;-webkit-touch-callout:none}
  .c1-act.show{pointer-events:auto;opacity:1;transform:scale(1)}
  .c1-act:active{transform:scale(.92);box-shadow:0 2px 0 #140a05}
  .c1-jump{position:absolute;right:clamp(18px,5vw,56px);bottom:calc(clamp(24px,8vh,70px) + clamp(100px,13vw,128px));width:clamp(78px,9.5vw,96px);height:clamp(78px,9.5vw,96px);border-radius:50%;border:3px solid #140a05;background:#93d8c6;color:#140a05;font-family:'Luckiest Guy','Impact',sans-serif;font-size:clamp(18px,2.1vw,22px);letter-spacing:.04em;box-shadow:0 6px 0 #140a05;pointer-events:none;opacity:0;transform:scale(.6);transition:opacity .2s,transform .25s cubic-bezier(.3,1.6,.5,1);cursor:pointer;touch-action:none;-webkit-touch-callout:none}
  .c1-jump.show{pointer-events:auto;opacity:1;transform:scale(1)}
  .c1-jump:active{transform:scale(.92);box-shadow:0 2px 0 #140a05}
  .c1-jump.big{right:auto;left:50%;bottom:22%;transform:translateX(-50%) scale(1.15);animation:c1pulse 1s ease-in-out infinite}
  .c1-crouch{position:absolute;right:calc(clamp(18px,5vw,56px) + clamp(88px,11vw,112px) + 14px);bottom:clamp(24px,8vh,70px);width:clamp(78px,9.5vw,96px);height:clamp(78px,9.5vw,96px);border-radius:50%;border:3px solid #140a05;background:#c3a6ff;color:#140a05;font-family:'Luckiest Guy','Impact',sans-serif;font-size:clamp(14px,1.7vw,18px);letter-spacing:.03em;box-shadow:0 6px 0 #140a05;pointer-events:none;opacity:0;transform:scale(.6);transition:opacity .2s,transform .25s cubic-bezier(.3,1.6,.5,1),background .15s;cursor:pointer;touch-action:none;-webkit-touch-callout:none}
  .c1-crouch.show{pointer-events:auto;opacity:1;transform:scale(1)}
  .c1-crouch.on{background:#3b2a63;color:#e9ddff;box-shadow:0 2px 0 #140a05,inset 0 0 0 3px #c3a6ff}
  .c1-crouch.hint{animation:c1pulse .7s ease-in-out infinite}
  .c1-noise{position:absolute;left:50%;top:calc(clamp(14px,3vh,28px) + 44px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;opacity:0;transition:opacity .4s;font-weight:700;font-size:12px;letter-spacing:.25em;color:#e9ddff;text-shadow:0 1px 0 #000}
  .c1-noise.show{opacity:1}
  .c1-noise i{display:block;width:clamp(120px,22vw,200px);height:10px;border-radius:6px;background:rgba(0,0,0,.55);border:1.5px solid rgba(233,221,255,.5);overflow:hidden}
  .c1-noise b{display:block;height:100%;width:0;background:linear-gradient(90deg,#7cd992,#f5d04a 55%,#ff4a3a)}
  .c1-pips{display:flex;gap:5px}.c1-pips i{width:9px;height:9px;border-radius:50%;background:rgba(20,10,5,.3)}.c1-pips i.on{background:#140a05}
  .c1-red{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(255,0,0,.38) 100%);opacity:0;transition:opacity .6s}
  .c1-red.on{opacity:1;animation:c1pulse 1s ease-in-out infinite}
  @keyframes c1pulse{50%{opacity:.35}}
  .c1-keys{position:absolute;left:50%;bottom:clamp(14px,3vh,26px);transform:translateX(-50%);font-size:13px;letter-spacing:.25em;text-transform:uppercase;color:#a49a8c;opacity:0;transition:opacity 1s;white-space:nowrap}
  .c1-keys.show{opacity:.7}
  .c1-flash{position:absolute;inset:0;background:#fff;opacity:0}
  .c1-flash.go{animation:c1flash 1.3s ease-out forwards}
  @keyframes c1flash{0%{opacity:1;background:#fff}12%{opacity:.95;background:#ffc070}100%{opacity:0;background:#ff4a10}}
  .c1-black{position:absolute;inset:0;background:#000;opacity:0;transition:opacity .45s}
  .c1-black.on{opacity:1}
  .c1-black.slow{transition-duration:1.6s}
  .c1-lids{position:absolute;inset:0;display:none}
  .c1-lids.on{display:block}
  .c1-lids i{position:absolute;left:-5%;right:-5%;height:52%;background:#000;border-radius:0 0 50% 50%/0 0 30% 30%}
  .c1-lids i:first-child{top:0}
  .c1-lids i:last-child{bottom:0;border-radius:50% 50% 0 0/30% 30% 0 0}
  .c1-lids.on i:first-child{animation:c1lidT 4.2s ease-in-out forwards}
  .c1-lids.on i:last-child{animation:c1lidB 4.2s ease-in-out forwards}
  @keyframes c1lidT{0%,8%{transform:translateY(0)}28%{transform:translateY(-38%)}40%{transform:translateY(0)}62%{transform:translateY(-62%)}72%{transform:translateY(-30%)}100%{transform:translateY(-105%)}}
  @keyframes c1lidB{0%,8%{transform:translateY(0)}28%{transform:translateY(38%)}40%{transform:translateY(0)}62%{transform:translateY(62%)}72%{transform:translateY(30%)}100%{transform:translateY(105%)}}
  .c1-toast{position:absolute;left:50%;bottom:28%;transform:translateX(-50%);max-width:86%;text-align:center;font-weight:600;font-size:clamp(16px,2vw,20px);letter-spacing:.12em;text-transform:uppercase;color:#f1e8d8;text-shadow:0 2px 0 #000,0 0 12px #000;opacity:0;transition:opacity .4s}
  .c1-toast.show{opacity:1}
  .c1-dead{position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;transition:opacity .5s}
  .c1-dead.show{opacity:1;pointer-events:auto}
  .c1-dead h2{font-family:'Luckiest Guy','Impact',sans-serif;font-weight:400;font-size:clamp(34px,6vw,70px);letter-spacing:.04em;color:#e8402e;-webkit-text-stroke:.08em #140a05;paint-order:stroke fill;text-shadow:0 .07em 0 #140a05;text-align:center;line-height:1}
  .c1-dead button{margin-top:18px;font-family:'Luckiest Guy','Impact',sans-serif;font-size:26px;letter-spacing:.06em;color:#140a05;background:#ff9443;border:0;border-radius:999px;padding:.45em 1.2em .3em;box-shadow:0 5px 0 #140a05;cursor:pointer}
  .c1-end{position:absolute;inset:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;pointer-events:none;transition:opacity 2.2s}
  .c1-end.show{opacity:1;pointer-events:auto}
  .c1-end h2{font-family:'Luckiest Guy','Impact',sans-serif;font-weight:400;font-size:clamp(34px,6vw,70px);letter-spacing:.04em;color:#ff9443;-webkit-text-stroke:.08em #140a05;paint-order:stroke fill;text-shadow:0 .07em 0 #140a05;text-align:center;line-height:1}
  .c1-end p{font-weight:600;font-size:clamp(15px,1.8vw,19px);letter-spacing:.3em;text-transform:uppercase;color:#93d8c6}
  .c1-end button{margin-top:18px;font-family:'Luckiest Guy','Impact',sans-serif;font-size:26px;letter-spacing:.06em;color:#140a05;background:#ff9443;border:0;border-radius:999px;padding:.45em 1.2em .3em;box-shadow:0 5px 0 #140a05;cursor:pointer}`;
  function onPress(el, fn) {
    let last = -1e9;
    const go = e => { const now = performance.now(); if (now - last < 400) return; last = now; if (e.type === 'pointerdown' && e.cancelable) e.preventDefault(); fn(); };
    el.addEventListener('pointerdown', go); el.addEventListener('click', go);
  }
  function makeHud(container, cfg = {}) {
    if (!document.getElementById('c1-css')) { const st = document.createElement('style'); st.id = 'c1-css'; st.textContent = HUD_CSS; document.head.appendChild(st); }
    const root = document.createElement('div'); root.className = 'c1-hud';
    root.innerHTML = '<div class="c1-red"></div><div class="c1-flash"></div><div class="c1-black"></div><div class="c1-lids"><i></i><i></i></div><div class="c1-obj"></div><div class="c1-toast"></div><div class="c1-keys">WASD / arrows to move \u00b7 drag to look \u00b7 E to use</div>' +
      '<div class="c1-zone"><div class="c1-joy"><div class="c1-thumb"></div></div></div>' +
      '<button class="c1-act" type="button"><span class="c1-label"></span><span class="c1-pips"></span></button>' +
      '<button class="c1-jump" type="button">JUMP</button>' +
      '<button class="c1-crouch" type="button">CROUCH</button>' +
      '<div class="c1-noise"><span>NOISE</span><i><b></b></i></div>' +
      '<div class="c1-dead"><h2>' + (cfg.deadTitle || 'YOU GOT<br>EATEN') + '</h2><button type="button">RESPAWN</button></div>' +
      '<div class="c1-end"><h2>' + (cfg.endTitle || 'CHAPTER 1<br>COMPLETE') + '</h2><p>(for now)</p><button type="button">MENU</button></div>';
    container.appendChild(root);
    const q = s => root.querySelector(s);
    return { root, obj: q('.c1-obj'), keys: q('.c1-keys'), zone: q('.c1-zone'), joy: q('.c1-joy'), thumb: q('.c1-thumb'), act: q('.c1-act'), label: q('.c1-label'), pips: q('.c1-pips'), red: q('.c1-red'), end: q('.c1-end'), endBtn: q('.c1-end button'),
      jump: q('.c1-jump'), crouch: q('.c1-crouch'), noise: q('.c1-noise'), noiseBar: q('.c1-noise b'), flash: q('.c1-flash'), black: q('.c1-black'), lids: q('.c1-lids'), toast: q('.c1-toast'), dead: q('.c1-dead'), respawn: q('.c1-dead button') };
  }

  /* ================= Clawrenzo (baked skinned model) ================= */
  function makeClaw(gl, data) {
    const meta = data.meta, raw = atob(data.b64), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const buf = bytes.buffer, ST = meta.stride;
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, 0, meta.vbytes), gl.STATIC_DRAW);
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(buf, meta.vbytes, meta.ibytes), gl.STATIC_DRAW);
    const frames = new Float32Array(buf, meta.vbytes + meta.ibytes, meta.fbytes / 4);
    const prims = meta.prims.map(p => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      const o = p.vstart * ST;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, ST, o);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, ST, o + 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.HALF_FLOAT, false, ST, o + 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, ST, o + 20);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, ST, o + 24);
      gl.bindVertexArray(null);
      return Object.assign({ vao }, p);
    });
    const texs = {};
    for (const k in data.tex) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 60, 50, 255]));
      texs[k] = t;
      const im = new Image();
      im.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        claw.texReady++;
      };
      im.src = 'data:image/png;base64,' + data.tex[k];
    }
    const J = meta.joints, skin = new Float32Array(J * 16);
    const boneTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, boneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, J, 0, gl.RGBA, gl.FLOAT, null);
    // pose = clip name + time (s); loops unless once
    function setPose(clip, time, once) {
      const c = meta.clips[clip], n = c.frames;
      let f = time * c.fps;
      if (once) f = Math.min(f, n - 1.001); else f = ((f % n) + n) % n;
      const f0 = Math.floor(f), f1 = once ? Math.min(f0 + 1, n - 1) : (f0 + 1) % n, u = f - f0;
      const A0 = (c.start + f0) * J * 12, A1 = (c.start + f1) * J * 12;
      for (let k = 0; k < J; k++) {
        const a = A0 + k * 12, b = A1 + k * 12, o = k * 16;
        // stored as rows (3x4); write column-major 4x4
        for (let r = 0; r < 3; r++) for (let col = 0; col < 4; col++) skin[o + col * 4 + r] = frames[a + r * 4 + col] * (1 - u) + frames[b + r * 4 + col] * u;
        skin[o + 3] = 0; skin[o + 7] = 0; skin[o + 11] = 0; skin[o + 15] = 1;
      }
    }
    function draw(pg, model, light) {
      gl.uniformMatrix4fv(pg.u.uModel, false, model);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, boneTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, J, gl.RGBA, gl.FLOAT, skin);
      gl.uniform1i(pg.u.uBones, 1); gl.uniform1i(pg.u.uFlip, 1); gl.uniform1f(pg.u.uSkinNoise, 0);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pg.u.uTex, 0);
      for (const p of prims) {
        const tex = p.tex >= 0 ? texs[p.tex] : null;
        gl.uniform1i(pg.u.uUseTex, tex ? 1 : 0); if (tex) gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform3fv(pg.u.uColor, tex ? [1, 1, 1] : p.color);
        gl.uniform3fv(pg.u.uEmissive, [p.emissive[0] * .7 * light, p.emissive[1] * .7 * light, p.emissive[2] * .7 * light]);
        gl.uniform1f(pg.u.uSpec, p.name === 'Eyes' ? 1.6 : .35); gl.uniform1f(pg.u.uShine, p.name === 'Eyes' ? 80 : 26);
        gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.icount, gl.UNSIGNED_SHORT, p.istart * 2);
      }
      gl.uniform3fv(pg.u.uEmissive, [0, 0, 0]);
      gl.bindVertexArray(null);
    }
    const claw = { meta, setPose, draw, texReady: 0, duration: k => meta.clips[k].frames / meta.clips[k].fps };
    return claw;
  }


  /* ================= main ================= */
  async function start(opts) {
    const canvas = opts.canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 not available');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const container = opts.container || canvas.parentElement;

    /* ---- Givanium citizen buffers ---- */
    const meta = opts.meta, bin = opts.bin, V = meta.vertexCount;
    let off = 0;
    const pos = new Float32Array(bin, off, V * 3); off += V * 12;
    const nor = new Float32Array(bin, off, V * 3); off += V * 12;
    const jnt = new Uint8Array(bin, off, V * 4); off += V * 4;
    const wgt = new Uint8Array(bin, off, V * 4); off += V * 4;
    const idx = new Uint16Array(bin, off, meta.bodyIndexCount + meta.eyeIndexCount);
    const sk = makeSkeleton(meta);
    const progW = compile(gl, VS_WORLD, FS), progS = compile(gl, VS_SKIN, FS);
    const cvao = gl.createVertexArray(); gl.bindVertexArray(cvao);
    const vb = (loc, data, size, type, norm) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
    vb(0, pos, 3, gl.FLOAT, false); vb(1, nor, 3, gl.FLOAT, false); vb(3, jnt, 4, gl.UNSIGNED_BYTE, false); vb(4, wgt, 4, gl.UNSIGNED_BYTE, true);
    const cib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const boneTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, boneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, sk.joints.length, 0, gl.RGBA, gl.FLOAT, null);
    const meshH = meta.bbox[1][1] - meta.bbox[0][1];
    const HEIGHT = 2.55, SC = HEIGHT / meshH, FOOT = -meta.bbox[0][1];

    /* ---- worlds ---- */
    const W = buildWorld(); const M = {}; for (const k in W) M[k] = meshFromGeo(gl, W[k]);
    const W2 = buildWorld2(); const M2 = {}; for (const k in W2) M2[k] = meshFromGeo(gl, W2[k]);
    const doorM = meshFromGeo(gl, buildDoor()), gdoorM = meshFromGeo(gl, buildGarageDoor());
    const TG = buildTruck(); const TM = {}; for (const k in TG) TM[k] = meshFromGeo(gl, TG[k]);
    const WG = buildWheel(); const WM = { tire: meshFromGeo(gl, WG.tire), hub: meshFromGeo(gl, WG.hub) };
    const FLG = buildFlashlight(); const FLM = { body: meshFromGeo(gl, FLG.body), lens: meshFromGeo(gl, FLG.lens) };
    const quadG = new Geo(); quadG.quad([-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    const blob = meshFromGeo(gl, quadG);
    const spriteG = new Geo(); spriteG.quad([-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    const sprite = meshFromGeo(gl, spriteG);
    const texFloor = texFromCanvas(gl, floorTexture(), aniso), texWall = texFromCanvas(gl, wallTexture(), aniso);
    const texBrick = texFromCanvas(gl, brickTexture(), aniso), texSign = texFromCanvas(gl, signTexture('SEWER', '#1d3a2a', '#e8e2c8'), aniso);
    const solids = buildSolids(), solids2 = buildSolids2();
    let claw = null;
    const ensureClaw = () => { if (!claw && opts.getClaw) { const d = opts.getClaw(); if (d) { try { claw = makeClaw(gl, d); } catch (e) { console.error(e); } } } return claw; };

    /* ---- hud, audio ---- */
    const hud = makeHud(container);
    const sfx = makeAudio(opts.getAC, opts.sfxOn || (() => true));
    const A = opts.audio || {};
    const musicVol = opts.musicVol || (() => 1), musicOn = opts.musicOn || (() => true);
    const envVoice = opts.envelope || '', envBuckle = opts.envBuckle || '', envMines = opts.envMines || '';
    function playEl(el, restart, isVoice) {
      if (!el) return;
      try { if (restart) el.currentTime = 0; if (!isVoice) { el.muted = !musicOn(); el.volume = musicVol(); } } catch (e) {}
      const p = el.play(); if (p && p.catch) p.catch(() => {});
    }
    const envAt = (el, env, offset = 0) => { if (!el || el.paused) return 0; const i = Math.floor((el.currentTime - offset) / .05); return i >= 0 && i < env.length ? (+env[i]) / 9 : 0; };

    /* ---- state ---- */
    const st = {
      area: 1, phase: 'visit', t: 0, camYaw: 0, camPitch: 0, camUp: null, eye: [0, 1.62, 3.55],
      a: { x: 0, z: -16.8, yaw: 0, walk: 0, ph: 0, look: 0, stopT: -1, askT: -1, started: false, endT: -1, leaveT: -1, role: 'walker', lastSide: 0, head: [0, 2.2, -16] },
      p: { x: 0, z: 3.55, yaw: 0, pitch: 0, bob: 0, lastStep: 0, moving: 0 },
      dragYaw: 0, dragPitch: 0,
      hits: 0, punchT: -9, shakeT: -9, fallT: -1, broken: false,
      alarmT: -1, rideAudio: null, hopT: -1, hopFrom: null, rideStart: -1, rc: 0, truckDist: 0, truckV: 0, dTurn: 0,
      buckleDone: false, minesDone: false, boomT: -1, crash: null,
      wakeT: -1, inSewer: false, hasLight: false, toastUntil: 0, toastKey: '', caughtT: -1, doneT: -1, timers: []
    };
    const mon = { state: 'off', x: 0, z: 0, yaw: 0, timer: 0, exposure: 0, animT: 0, clip: 'idle', stepT: 0, growlT: 0, warned: false, flee: null };
    const truckZ = () => TRUCK_Z0 - st.truckDist;

    const later = (t, fn) => st.timers.push({ at: st.t + t, fn });

    /* ---- input ---- */
    const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
    let lookId = null, lx = 0, ly = 0;
    const keys = { f: 0, b: 0, l: 0, r: 0 };
    const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    const controlling = () => st.phase === 'free' || st.phase === 'alarm' || st.phase === 'explore';
    function resetJoy() { hud.joy.style.left = '96px'; hud.joy.style.top = Math.max(70, hud.zone.clientHeight - 104) + 'px'; hud.thumb.style.transform = ''; }
    resetJoy();
    const onZoneDown = e => {
      if (joy.id !== null) return;
      joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
      const r = hud.zone.getBoundingClientRect();
      hud.joy.style.left = (e.clientX - r.left) + 'px'; hud.joy.style.top = (e.clientY - r.top) + 'px';
      try { hud.zone.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    };
    const onCanvasDown = e => {
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    };
    function look(dx, dy) {
      const k = .0055;
      if (controlling()) { st.p.yaw += dx * k; st.p.pitch = clamp(st.p.pitch - dy * k, -1.2, 1.2); }
      else if (st.phase === 'caught' || st.phase === 'dead' || st.phase === 'crash') return;
      else {
        st.dragYaw += dx * k; st.dragPitch = clamp(st.dragPitch - dy * k, -.9, .9);
        st.dragYaw = clamp(st.dragYaw, st.phase === 'visit' ? -1.3 : -2.8, st.phase === 'visit' ? 1.3 : 2.8);
      }
    }
    const onMove = e => {
      if (e.pointerId === joy.id) {
        let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const R = 50, d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        joy.x = dx / R; joy.y = dy / R;
        hud.thumb.style.transform = `translate(${dx}px,${dy}px)`;
      } else if (e.pointerId === lookId) {
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        look(dx, dy);
      }
    };
    const onUp = e => {
      if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; resetJoy(); }
      if (e.pointerId === lookId) lookId = null;
    };
    const onKey = e => {
      const k = KEYMAP[e.code];
      if (k) { keys[k] = e.type === 'keydown' ? 1 : 0; if (controlling()) e.preventDefault(); }
      if (e.type === 'keydown' && !e.repeat && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { if (actMode) { e.preventDefault(); onAct(); } }
    };
    const onBlur = () => { keys.f = keys.b = keys.l = keys.r = 0; };
    hud.zone.addEventListener('pointerdown', onZoneDown);
    canvas.addEventListener('pointerdown', onCanvasDown);
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur);
    onPress(hud.act, onAct);
    hud.endBtn.addEventListener('click', () => { opts.onExit && opts.onExit(); });
    hud.respawn.addEventListener('click', () => respawn());

    /* ---- hud helpers ---- */
    let actMode = '';
    function setObjective(text, alarm) { hud.obj.textContent = text || ''; hud.obj.classList.toggle('show', !!text); hud.obj.classList.toggle('alarm', !!alarm); }
    function toast(text, key, secs = 3) {
      if (key && st.toastKey === key && st.t < st.toastUntil + 4) return;
      st.toastKey = key || text; st.toastUntil = st.t + secs; hud.toast.textContent = text; hud.toast.classList.add('show');
    }
    function setControls(on) {
      hud.zone.classList.toggle('on', on); if (!on) { joy.id = null; joy.x = joy.y = 0; resetJoy(); hud.act.classList.remove('show'); actMode = ''; }
      else resetJoy();
    }
    function renderPips() { hud.pips.innerHTML = [0, 1, 2].map(i => `<i class="${i < st.hits ? 'on' : ''}"></i>`).join(''); }
    const near2 = (x, z, r) => Math.hypot(st.p.x - x, st.p.z - z) < r;
    function currentAct() {
      const p = st.p;
      if (st.phase === 'free' && !st.broken && p.z < Z_BARS + 1.3 && p.z > Z_BARS && Math.abs(p.x) < .95) return 'hit';
      if (st.phase === 'alarm') {
        const b = TRUCK_SOLID, dx = Math.max(b[0] - p.x, 0, p.x - b[1]), dz = Math.max(b[2] - p.z, 0, p.z - b[3]);
        if (Math.hypot(dx, dz) < 1.0) return 'in';
      }
      if (st.phase === 'explore') {
        if (!st.inSewer && near2(SEWER_DOOR[0], SEWER_DOOR[1], 1.5)) return 'enter';
        if (st.inSewer && !st.hasLight && near2(FLASH_POS[0], FLASH_POS[2], 1.9)) return 'take';
        if (st.inSewer && near2(LADDER_X - .4, LADDER_Z, 2.2)) return 'climb';
      }
      return '';
    }
    const ACT_LABEL = { hit: 'HIT', in: 'GET IN', enter: 'ENTER', take: 'TAKE', climb: 'CLIMB' };
    function updateAct() {
      const m = currentAct();
      if (m === actMode) return;
      actMode = m;
      hud.act.classList.toggle('show', !!m);
      if (m) { hud.label.textContent = ACT_LABEL[m]; hud.pips.innerHTML = ''; if (m === 'hit') renderPips(); }
    }
    function onAct() {
      if (actMode === 'hit') doHit();
      else if (actMode === 'in') getIn();
      else if (actMode === 'enter') enterSewer();
      else if (actMode === 'take') takeLight();
      else if (actMode === 'climb') climbOut();
    }

    /* ---- act 1 story beats ---- */
    function doHit() {
      if (st.t - st.punchT < .3) return;
      st.punchT = st.t; st.shakeT = st.t; st.hits++;
      sfx.clang(.7 + st.hits * .15);
      renderPips();
      if (st.hits >= 3) breakOut();
    }
    function breakOut() {
      st.broken = true; st.fallT = st.t; st.phase = 'alarm'; st.alarmT = st.t;
      sfx.crash();
      playEl(A.borrowed, true);             // started inside the tap so phones allow it
      setObjective('RUN TO THE CAR!', true); hud.red.classList.add('on');
      actMode = '__'; updateAct();
    }
    function getIn() {
      st.phase = 'hop'; st.hopT = st.t;
      st.hopFrom = { x: st.eye[0], y: st.eye[1], z: st.eye[2], yaw: st.camYaw, pitch: st.camPitch };
      setControls(false); hud.keys.classList.remove('show'); setObjective(''); hud.red.classList.remove('on');
      if (A.borrowed) A.borrowed.pause();
      // one sound file for the whole ride (music + both driver lines): phones often allow only one at a time
      if (musicOn() && A.ride) { st.rideAudio = A.ride; playEl(A.ride, true); }
      else for (const el of [A.buckle, A.mines]) if (el) { try { const p = el.play(); el.pause(); el.currentTime = 0; if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    }
    function beginFree() {
      st.phase = 'free';
      st.p.yaw = st.camYaw; st.p.pitch = st.camPitch; st.dragYaw = st.dragPitch = 0;
      setControls(true);
      setObjective('Break out of the cage');
      if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) { hud.keys.classList.add('show'); setTimeout(() => hud.keys.classList.remove('show'), 9000); }
    }
    function startVoice() {
      const v = A.voice; if (!v) { st.a.endT = st.t; return; }
      v.onended = () => { if (st.a.endT < 0) st.a.endT = st.t; };
      v.onplaying = () => { st.a.started = true; };
      try { v.currentTime = 0; } catch (e) {}
      const p = v.play(); if (p && p.catch) p.catch(() => opts.onVoiceBlocked && opts.onVoiceBlocked());
    }

    /* ---- creature A (visitor, later the driver) ---- */
    const A_STOP = 0.78, A_SPEED = 1.45, A_GONE = -19.5, T_WALK = 2.0;
    function updateA(t, dt) {
      const a = st.a;
      if (a.role !== 'walker') return;
      if (a.leaveT < 0) {
        const remaining = A_STOP - a.z;
        if (t > T_WALK && remaining > 0) {
          a.walk = lerp(a.walk, clamp(remaining / 1.1, .3, 1), Math.min(1, dt * 3));
          a.z = Math.min(A_STOP, a.z + A_SPEED * a.walk * dt);
          a.ph += dt * a.walk * Math.PI * 2 * (A_SPEED / 1.9);
        } else if (remaining <= 0) {
          a.walk = lerp(a.walk, 0, Math.min(1, dt * 5));
          if (a.stopT < 0) a.stopT = t;
        }
        if (a.stopT >= 0) {
          a.look = smooth(a.stopT + .6, a.stopT + 2.1, t);
          if (a.askT < 0 && t > a.stopT + 2.3) { a.askT = t; startVoice(); }
          if (a.askT >= 0 && !a.started && a.endT < 0 && t > a.askT + 9) a.endT = t;
          if (a.endT >= 0 && t > a.endT + .8) a.leaveT = t;
        }
      } else {
        const k = t - a.leaveT;
        a.look = 1 - smooth(0, 1, k);
        a.yaw = smooth(.6, 2.2, k) * Math.PI;
        if (k < 2.2) { a.walk = lerp(a.walk, k > .6 ? .45 : 0, Math.min(1, dt * 4)); a.ph += dt * a.walk * Math.PI * 2 * .6; }
        else { a.walk = lerp(a.walk, 1, Math.min(1, dt * 2)); a.z -= A_SPEED * a.walk * dt; a.ph += dt * a.walk * Math.PI * 2 * (A_SPEED / 1.9); }
        if (st.phase === 'visit' && k > 3.4) beginFree();
        if (a.z < A_GONE) a.role = 'driver';
      }
      const side = Math.cos(a.ph) > 0 ? 1 : -1;
      if (a.walk > .25 && side !== a.lastSide) { a.lastSide = side; sfx.step(clamp(1.2 / (1 + Math.hypot(a.x - st.p.x, a.z - st.p.z) * .35), .03, .9) * a.walk); }
    }

    /* ---- the ride: clock follows the ride track so the voice lines, the mine and the music stay in step ---- */
    const HOP = 1.1, BUCKLE_AT = 1.3, MINES_AT = 14.0;              // seconds into ride.mp3
    const T_GO = 3.6, ACC = 2.2, VMAX = 12, T_ACC = VMAX / ACC, D_ACC = .5 * ACC * T_ACC * T_ACC;
    const distAt = rc => { const k = rc - T_GO; if (k <= 0) return 0; if (k < T_ACC) return .5 * ACC * k * k; return D_ACC + VMAX * (k - T_ACC); };
    const speedAt = rc => { const k = rc - T_GO; return k <= 0 ? 0 : Math.min(VMAX, ACC * k); };
    function updateRide(t, dt) {
      if (st.phase !== 'ride') return;
      const el = st.rideAudio;
      if (el && !el.paused && el.currentTime > 0) st.rc = Math.max(st.rc, el.currentTime - HOP); else st.rc += dt;
      const rc = st.rc;
      st.truckDist = distAt(rc); st.truckV = speedAt(rc);
      if (!el) {   // music off: the two lines play on their own
        if (!st.buckleDone && rc > BUCKLE_AT - HOP) { st.buckleDone = true; playEl(A.buckle, true, true); }
        if (!st.minesDone && rc > MINES_AT - HOP) { st.minesDone = true; playEl(A.mines, true, true); }
      }
      if (truckZ() - 3.4 <= MINE_Z + .2) startCrash(t);
    }
    function driverTalk() {
      const el = st.rideAudio;
      if (el) {
        if (el.paused) return [0, 0];
        const at = el.currentTime;
        if (at >= BUCKLE_AT && at < BUCKLE_AT + 5.4) return [envAt(el, envBuckle, BUCKLE_AT), 1];
        if (at >= MINES_AT && at < MINES_AT + 5.6) return [envAt(el, envMines, MINES_AT), .55];
        return [0, 0];
      }
      if (A.buckle && !A.buckle.paused) return [envAt(A.buckle, envBuckle), 1];
      if (A.mines && !A.mines.paused) return [envAt(A.mines, envMines), .55];
      return [0, 0];
    }
    function startCrash(t) {
      st.phase = 'crash'; st.boomT = t;
      st.crash = { x: 0, y: 0, z: truckZ(), vx: 5.2, vy: 8.2, vz: -st.truckV * .8, pitch: 0, roll: 0, yaw: 0, wp: 1.15, wr: -2.0, wy: -.55 };
      if (st.rideAudio) st.rideAudio.pause();
      for (const el of [A.buckle, A.mines]) if (el) el.pause();
      sfx.boom(); hud.flash.classList.remove('go'); void hud.flash.offsetWidth; hud.flash.classList.add('go');
      later(.45, () => sfx.ring(1));
      later(1.75, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(5.4, () => enterArea2());
    }
    function truckMatrix(t) {
      const c = st.crash;
      if (c) return M4.trs([c.x, c.y, c.z], Q.mul(Q.mul(Q.aa(0, 1, 0, c.yaw), Q.aa(1, 0, 0, c.pitch)), Q.aa(0, 0, 1, c.roll)), [1, 1, 1]);
      return M4.trs([0, truckBounce(t), truckZ()], [0, 0, 0, 1], [1, 1, 1]);
    }
    function updateCrash(dt) {
      const c = st.crash; if (!c) return;
      c.vy -= 9.8 * dt; c.vz *= (1 - .35 * dt);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.pitch += c.wp * dt; c.roll += c.wr * dt; c.yaw += c.wy * dt;
    }

    /* ---- act 2 ---- */
    function enterArea2() {
      st.area = 2; st.phase = 'wake'; st.wakeT = st.t; st.crash = null;
      st.p = { x: 0, z: 4.25, yaw: 0, pitch: 0, bob: 0, lastStep: 0, moving: 0 };
      st.dragYaw = 0; st.dragPitch = 0;
      hud.lids.classList.remove('on'); void hud.lids.offsetWidth; hud.lids.classList.add('on');
      hud.black.classList.remove('on');
      later(3.5, () => sfx.ring(0));
    }
    function beginExplore() {
      st.phase = 'explore'; st.p.yaw = st.camYaw; st.p.pitch = st.camPitch; st.dragYaw = st.dragPitch = 0;
      setControls(true); setObjective('Find a way out');
      hud.lids.classList.remove('on');
    }
    function enterSewer() {
      st.phase = 'door'; setControls(false); sfx.creak();
      hud.black.classList.remove('slow'); hud.black.classList.add('on');
      later(.8, () => {
        const [cx, cz] = cellC(...S_CELL);
        st.inSewer = true; st.p.x = cellX0(S_CELL[0]) + 1.0; st.p.z = cz; st.p.yaw = Math.PI / 2; st.p.pitch = 0;
        st.phase = 'explore'; setControls(true); setObjective('Find a flashlight');
        hud.black.classList.add('slow'); hud.black.classList.remove('on');
        toast('The door slammed shut behind you', 'door');
      });
    }
    function takeLight() {
      st.hasLight = true; sfx.pickup(); setObjective('Find the exit');
      toast('If something comes for you, shine the light straight at it', 'light', 4.5);
      mon.state = 'away'; mon.timer = st.t + 9;
      updateAct();
    }
    function climbOut() {
      st.phase = 'done'; st.doneT = st.t; setControls(false); setObjective(''); mon.state = 'off';
      hud.black.classList.add('slow'); hud.black.classList.add('on');
      later(1.8, () => { hud.end.classList.add('show'); opts.onComplete && opts.onComplete(); });
    }
    function checkpoint() {
      if (!st.inSewer) return [0, 4.25, 0];
      if (st.hasLight) return [FLASH_POS[0] + 1.2, FLASH_POS[2], Math.PI / 2];
      return [cellX0(S_CELL[0]) + 1.0, cellC(...S_CELL)[1], Math.PI / 2];
    }
    function respawn() {
      if (st.phase !== 'dead') return;
      const [x, z, yaw] = checkpoint();
      st.p.x = x; st.p.z = z; st.p.yaw = yaw; st.p.pitch = 0;
      mon.state = 'away'; mon.timer = st.t + 12; mon.exposure = 0;
      hud.dead.classList.remove('show'); hud.black.classList.add('on');
      st.phase = 'explore'; setControls(true);
      later(.15, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
    }

    /* ---- player ---- */
    function pushOut(p, list) {
      const r = .28;
      for (const b of list) {
        const cx = clamp(p.x, b[0], b[1]), cz = clamp(p.z, b[2], b[3]);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
        else {
          const pen = [[p.x - b[0] + r, -1, 0], [b[1] - p.x + r, 1, 0], [p.z - b[2] + r, 0, -1], [b[3] - p.z + r, 0, 1]].sort((u, w) => u[0] - w[0])[0];
          p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0];
        }
      }
    }
    function collide(p) {
      for (let it = 0; it < 2; it++) {
        if (st.area === 1) { const list = solids.slice(); if (!st.broken) list.push(DOOR_SOLID); list.push(TRUCK_SOLID); pushOut(p, list); }
        else if (!st.inSewer) pushOut(p, solids2);
        else {
          const [c, r] = cellOf(p.x, p.z), list = [];
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!walkable(c + dc, r + dr)) { const x0 = cellX0(c + dc), z1 = cellZ0(r + dr); list.push([x0, x0 + CS, z1 - CS, z1]); }
          list.push([FLASH_POS[0] - .4, FLASH_POS[0] + .4, FLASH_POS[2] - .45, FLASH_POS[2] + .45]);
          pushOut(p, list);
        }
      }
    }
    function updatePlayer(t, dt) {
      const p = st.p;
      if (!controlling()) return;
      let mx = joy.x, my = joy.y;
      if (keys.f) my -= 1; if (keys.b) my += 1; if (keys.l) mx -= 1; if (keys.r) mx += 1;
      const mag = Math.min(1, Math.hypot(mx, my));
      if (mag > .06) {
        const n = Math.hypot(mx, my), ux = mx / n * mag, uy = my / n * mag;
        const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
        const sp = st.phase === 'alarm' ? 4.3 : st.area === 2 ? 2.5 : 2.0;
        p.x += (fx * -uy + rx * ux) * sp * dt; p.z += (fz * -uy + rz * ux) * sp * dt;
        collide(p);
      }
      p.moving = lerp(p.moving, mag > .06 ? mag : 0, Math.min(1, dt * 8));
      p.bob += dt * p.moving * (st.phase === 'alarm' ? 11 : 7.5);
      const s = Math.sin(p.bob) > 0 ? 1 : -1;
      if (p.moving > .3 && s !== p.lastStep) { p.lastStep = s; if (st.inSewer) sfx.splash(.35 + p.moving * .3); else sfx.pstep(.25 + p.moving * .25); }
      updateAct();
      if (st.area === 2 && !st.inSewer) {   // what's blocked
        const fz = -Math.cos(p.yaw), fx = Math.sin(p.yaw);
        if (p.z > 4.0 && fz > .5) toast('The door is blocked with junk', 'backdoor');
        if (p.z < -7.4 && p.x > 1.2 && fx > .4) toast("Blocked \u2014 you can't go right\u2026 for now", 'right');
      }
    }

    /* ---- Clawrenzo ---- */
    const CLAW_SC = .5, CLAW_BODY = 1.8;    // model units: body centre sits 1.8 ahead of the origin
    const camFwd = () => [Math.sin(st.camYaw) * Math.cos(st.camPitch), Math.sin(st.camPitch), -Math.cos(st.camYaw) * Math.cos(st.camPitch)];
    function monSpawn() {
      const [pc, pr] = cellOf(st.p.x, st.p.z), dist = sewerBFS(pc, pr), cand = [];
      for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) {
        const d = dist[r * MAP_W + c]; if (d < 4) continue;
        const [x, z] = cellC(c, r); if (sewerLOS(x, z, st.p.x, st.p.z)) continue;
        cand.push([d, x, z]);
      }
      if (!cand.length) { mon.timer = st.t + 4; return; }
      cand.sort((u, w) => u[0] - w[0]);
      const pick = cand[Math.min(cand.length - 1, Math.floor(Math.random() * Math.min(4, cand.length)))];
      mon.x = pick[1]; mon.z = pick[2]; mon.state = 'hunt'; mon.exposure = 0; mon.animT = 0; mon.growlT = st.t + 1;
    }
    function stepToward(fromX, fromZ, goalC, goalR) {
      const [c, r] = cellOf(fromX, fromZ), dist = sewerBFS(goalC, goalR), here = dist[r * MAP_W + c];
      let best = null;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr; if (!walkable(nc, nr)) continue;
        const d = dist[nr * MAP_W + nc]; if (d >= 0 && (here < 0 || d < here) && (!best || d < best[0])) best = [d, nc, nr];
      }
      if (!best) { const [x, z] = cellC(c, r); return [x, z]; }
      // stay near the centre line before turning a corner
      const [cx, cz] = cellC(c, r), [nx, nz] = cellC(best[1], best[2]);
      if (Math.abs(fromX - cx) > .6 && best[1] === c) return [cx, cz];
      if (Math.abs(fromZ - cz) > .6 && best[2] === r) return [cx, cz];
      return [nx, nz];
    }
    function monMove(target, speed, dt) {
      const dx = target[0] - mon.x, dz = target[1] - mon.z, d = Math.hypot(dx, dz);
      if (d > .01) { const k = Math.min(1, speed * dt / d); mon.x += dx * k; mon.z += dz * k; }
      if (d > .05) mon.yaw = lerpAngle(mon.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    }
    function lightOnMonster(e0, f0) {
      if (!st.hasLight) return false;
      const f = f0 || camFwd(), e = e0 || st.eye;
      for (const [hx, hy] of [[0, 1.3], [1.0, 2.1], [-.6, 1.0]]) {
        const tx = mon.x + Math.sin(mon.yaw) * hx, tz = mon.z + Math.cos(mon.yaw) * hx;
        const vx = tx - e[0], vy = hy - e[1], vz = tz - e[2], d = Math.hypot(vx, vy, vz);
        if (d > 14) continue;
        if ((vx * f[0] + vy * f[1] + vz * f[2]) / d > Math.cos(15 * D) && sewerLOS(e[0], e[2], mon.x, mon.z)) return true;
      }
      return false;
    }
    function startCaught() {
      st.phase = 'caught'; st.caughtT = st.t; setControls(false); setObjective('');
      mon.state = 'scare'; mon.animT = 0; sfx.scream();
      const fx = Math.sin(st.p.yaw), fz = -Math.cos(st.p.yaw);
      mon.x = st.p.x + fx * 2.85; mon.z = st.p.z + fz * 2.85; mon.yaw = Math.atan2(-fx, -fz);
      later(2.5, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(3.0, () => { st.phase = 'dead'; hud.dead.classList.add('show'); });
    }
    function updateMonster(t, dt) {
      if (st.area !== 2 || !st.inSewer) return;
      if (!ensureClaw()) return;
      const m = mon, p = st.p, d = Math.hypot(p.x - m.x, p.z - m.z);
      if (m.state === 'off') return;
      if (m.state === 'away') { if (t > m.timer && st.phase === 'explore') monSpawn(); return; }
      if (m.state === 'scare') { m.clip = 'scare'; m.animT += dt; return; }
      if (st.phase !== 'explore') return;
      const audible = clamp(1.4 / (1 + d * .25), 0, 1);
      if (m.state === 'hunt') {
        const see = d < 10 && sewerLOS(m.x, m.z, p.x, p.z);
        const [pc, pr] = cellOf(p.x, p.z);
        const target = see ? [p.x, p.z] : stepToward(m.x, m.z, pc, pr);
        const sp = see && d < 8 ? 2.8 : 2.2;
        monMove(target, sp, dt); m.clip = 'run'; m.animT += dt * sp / 2.4;
        if (lightOnMonster()) m.exposure += dt; else m.exposure = Math.max(0, m.exposure - dt * .4);
        if (!m.warned && see && d < 11) { m.warned = true; toast('Shine your flashlight straight at it!', 'warn', 4); }
        if (m.exposure > .7) { m.state = 'stun'; m.timer = t; m.animT = 0; sfx.screech(); }
        else if (d < 1.6) { startCaught(); return; }
        if (t > m.stepT) { m.stepT = t + .3; sfx.clack(audible); }
        if (t > m.growlT) { m.growlT = t + 2.5 + Math.random() * 2.5; sfx.growl(audible); }
      } else if (m.state === 'stun') {
        m.clip = 'shock'; m.animT = t - m.timer;
        m.yaw = lerpAngle(m.yaw, Math.atan2(p.x - m.x, p.z - m.z), Math.min(1, dt * 4));
        if (t - m.timer > 1.55) {
          const [pc, pr] = cellOf(p.x, p.z), dist = sewerBFS(pc, pr); let best = null;
          for (let r = 0; r < MAP_H; r++) for (let c = 0; c < MAP_W; c++) { const dd = dist[r * MAP_W + c]; if (dd >= 0 && (!best || dd > best[0])) best = [dd, c, r]; }
          m.flee = [best[1], best[2]]; m.state = 'flee';
        }
      } else if (m.state === 'flee') {
        const target = stepToward(m.x, m.z, m.flee[0], m.flee[1]);
        monMove(target, 3.8, dt); m.clip = 'run'; m.animT += dt * 1.5;
        if (t > m.stepT) { m.stepT = t + .22; sfx.clack(audible); }
        const [mc, mr] = cellOf(m.x, m.z);
        if ((d > 12 && !sewerLOS(m.x, m.z, p.x, p.z)) || (mc === m.flee[0] && mr === m.flee[1])) { m.state = 'away'; m.timer = t + 14 + Math.random() * 10; }
      }
    }

    /* ---- lights ---- */
    const LIGHTS = [];
    LAMPS_Z.forEach((z, i) => LIGHTS.push({ kind: 'lamp', i, p: [0, 2.55, z], r: 10 }));
    LIGHTS.push({ kind: 'cell', p: [0, H - .32, 3.1], r: 7 });
    for (const z of [-19.5, -31]) LIGHTS.push({ kind: 'tube', p: [0, GH - .35, z], r: 12 });
    const BEACONS = [[-5.5, -24], [5.5, -24], [-5.5, -32], [5.5, -32]];
    BEACONS.forEach((b, i) => LIGHTS.push({ kind: 'beacon', i, p: [b[0], 3.4, b[1]], r: 9 }));
    for (const s of [-1, 1]) LIGHTS.push({ kind: 'head', s, p: [0, 0, 0], r: 13 });
    TUN_LAMPS.forEach(z => LIGHTS.push({ kind: 'tun', p: [-TW + 1.35, 3.3, z], r: 12 }));
    SODIUM.forEach(z => LIGHTS.push({ kind: 'sod', p: [TW - .45, 2.8, z], r: 9 }));
    BR_LAMPS.forEach(([s, z]) => LIGHTS.push({ kind: 'brl', p: [s * (TW + .15) - s * 1.3, 4.8, z], r: 20 }));
    LIGHTS.push({ kind: 'boom', p: [0, 1.5, MINE_Z], r: 45 });
    const LIGHTS2 = [
      { kind: 'bulb2', p: [0, 2.4, 3], r: 8 }, { kind: 'corr2', p: [-.75, 2.3, -4], r: 7 }, { kind: 'door2', p: [-8.6, 2.75, -9.1], r: 6 }, { kind: 'junk2', p: [1.6, 2.6, -8.7], r: 5.5 },
      { kind: 'torchglow', p: [FLASH_POS[0] + .1, FLASH_POS[1] + .25, FLASH_POS[2]], r: 3.2 },
      { kind: 'exit', p: [LADDER_X - .7, SH + 2.6, LADDER_Z], r: 11 }
    ];
    SEWER_LAMPS.forEach((L, i) => { const p = lampPos(L); LIGHTS2.push({ kind: 'slamp', i, p: [p[0] + (L[2] === 'w' ? .3 : L[2] === 'e' ? -.3 : 0), p[1], p[2] + (L[2] === 'n' ? -.3 : L[2] === 's' ? .3 : 0)], r: 7.5 }); });
    const Lpos = new Float32Array(24), Lcol = new Float32Array(24), Lrange = new Float32Array(8);
    let Ln = 0;
    const lampLevel = [1, 1, 1, .12];
    const WARM = [1.0, .78, .55], RED = [1, .07, .04];
    const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const sc3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    let env = { am: 0, pulse: 0, tun: 0, out: 0 };
    let flick2 = 1;
    function updateLights(t, talk) {
      const cand = [];
      const push = (L, c) => {
        const d = Math.hypot(L.p[0] - st.eye[0], L.p[1] - st.eye[1], L.p[2] - st.eye[2]);
        if (d > 45 || c[0] + c[1] + c[2] < .02) return;
        cand.push({ L, c, s: d - L.r * .5 });
      };
      if (st.area === 1) {
        lampLevel[0] = 1 - talk * .25 * (Math.random() > .5 ? 1 : 0); lampLevel[1] = 1;
        lampLevel[2] = (Math.sin(t * 37) > .93 || (t % 7.3) < .18) ? .15 : 1;
        lampLevel[3] = (Math.sin(t * 2.1) > .97) ? .9 : .05 + Math.random() * .03;
        const am = st.alarmT < 0 ? 0 : smooth(st.alarmT, st.alarmT + .4, t) * (1 - smooth(-40, -80, st.eye[2]));
        const pulse = .5 + .5 * Math.sin(t * 6.5);
        const tun = smooth(-36, -48, st.eye[2]), out = smooth(Z_TUN_END + 6, Z_TUN_END - 8, st.eye[2]);
        env = { am, pulse, tun, out };
        const tm = truckMatrix(t);
        for (const L of LIGHTS) {
          let c;
          if (L.kind === 'lamp') c = mix3(sc3(WARM, 3.2 * lampLevel[L.i]), sc3(RED, 2.4 * (.45 + .55 * (.5 + .5 * Math.sin(t * 6.5 + L.i * 1.3)))), am);
          else if (L.kind === 'cell') c = mix3(sc3([1, .82, .6], 1.35 * (lampLevel[1] * .9 + .1)), sc3(RED, 1.1 * pulse), am);
          else if (L.kind === 'tube') c = mix3([1.1, 1.25, 1.4], sc3(RED, 2.6 * pulse), am);
          else if (L.kind === 'beacon') { const a = t * 4 + L.i; L.p = [BEACONS[L.i][0] - Math.sign(BEACONS[L.i][0]) * (.6 + Math.cos(a) * .5), 3.4, BEACONS[L.i][1] + Math.sin(a) * .9]; c = sc3(RED, 2.6 * am); }
          else if (L.kind === 'head') { L.p = M4.xform(tm, [L.s * .8, 1.25, -3.6]); c = st.boomT >= 0 && t - st.boomT > .8 ? [0, 0, 0] : [2.4, 2.2, 1.8]; }
          else if (L.kind === 'tun') c = [2.6, 2.2, 1.6];
          else if (L.kind === 'brl') c = [2.6, 1.3, .45];
          else if (L.kind === 'boom') { const k = st.boomT < 0 ? 9 : t - st.boomT; c = k > 4 ? [0, 0, 0] : sc3([9, 5, 1.8], Math.exp(-k * 2.2)); }
          else c = [2.2, 1.0, .3];
          push(L, c);
        }
      } else {
        flick2 = (Math.sin(t * 29) > .95 || (t % 5.7) < .12) ? .25 : 1;
        env = { am: 0, pulse: 0, tun: 0, out: 0 };
        for (const L of LIGHTS2) {
          let c;
          if (L.kind === 'bulb2') c = sc3([1, .8, .55], 2.3 * flick2);
          else if (L.kind === 'corr2') c = sc3([1, .78, .5], 1.3);
          else if (L.kind === 'door2') c = [.5, 1.3, .7];
          else if (L.kind === 'junk2') c = sc3([1, .75, .5], .9 * flick2);
          else if (L.kind === 'torchglow') c = st.hasLight ? [0, 0, 0] : [.45, .55, .7];
          else if (L.kind === 'exit') c = [2.6, 2.9, 3.4];
          else c = sc3([1, .6, .28], L.i === 2 ? 1.2 * flick2 : 1.2);
          push(L, c);
        }
      }
      cand.sort((u, w) => u.s - w.s);
      Ln = Math.min(8, cand.length);
      for (let i = 0; i < Ln; i++) { Lpos.set(cand[i].L.p, i * 3); Lcol.set(cand[i].c, i * 3); Lrange[i] = cand[i].L.r; }
    }

    /* ---- citizens ---- */
    const skinA = new Float32Array(sk.skin.length), skinB = new Float32Array(sk.skin.length);
    let modelA = M4.ident(), modelB = M4.ident(), shadowA = null;
    const SEAT_EYE = [-.42, 1.84, 2.4];
    function truckBounce(t) { return st.truckV > .1 ? .016 * Math.sin(st.truckDist * 3.1) + .01 * Math.sin(st.truckDist * 7.3) : .003 * Math.sin(t * 38); }
    function placeSitting(tm, hipLocal, yaw, sc) {
      const hp = jointMeshPos(sk, 'Hips');
      return M4.mul(tm, M4.mul(M4.trs(hipLocal, Q.aa(0, 1, 0, yaw), [sc, sc, sc]), M4.trs([-hp[0], -hp[1], -hp[2]], [0, 0, 0, 1], [1, 1, 1])));
    }
    function poseCitizens(t, dt) {
      const a = st.a, tm = truckMatrix(t);
      if (a.role === 'walker') {
        const talk = envAt(A.voice, envVoice);
        const dist = Math.max(.5, Math.hypot(a.x - st.eye[0], a.z - st.eye[2]));
        const lookPitch = a.look * Math.atan2(HEIGHT * .86 - st.eye[1], dist);
        poseSkeleton(sk, walkPose(a.walk, a.ph, a.look, lookPitch, talk, t));
        let lift = Infinity;
        for (const nm of ['LeftFoot', 'RightFoot', 'LeftToe_End', 'RightToe_End']) { const k = sk.byName[nm]; if (k !== undefined) lift = Math.min(lift, jointMeshPos(sk, nm)[1] - sk.restMeshPos[k][1]); }
        if (!isFinite(lift)) lift = 0;
        const sway = Math.sin(a.ph) * .03 * a.walk;
        modelA = M4.trs([a.x + sway * Math.cos(a.yaw), (FOOT - lift) * SC, a.z], Q.aa(0, 1, 0, a.yaw + Math.sin(a.ph) * 3 * D * a.walk), [SC, SC, SC]);
        shadowA = [a.x, a.z];
      } else {
        const [talk, turnTo] = driverTalk();
        st.dTurn = lerp(st.dTurn, turnTo, Math.min(1, dt * 3.5));
        const panic = st.crash ? 1 : 0;
        poseSkeleton(sk, sitPose({ t, hip: 86 * D, knee: 82 * D, hunch: 10 * D, armDown: (40 - panic * 30) * D, armFwd: 74 * D, elbow: 24 * D, headPitch: -4 * D + talk * 3 * D, neckYaw: st.dTurn * 75 * D, tilt: st.dTurn * 8 * D, talk }));
        modelA = placeSitting(tm, [-.45, 1.2, -.6], Math.PI, SC);
        shadowA = null;
      }
      st.a.head = M4.xform(modelA, jointMeshPos(sk, 'Head'));
      skinA.set(sk.skin);
      const riding = st.phase === 'hop' || st.phase === 'ride' || st.phase === 'crash';
      const watch = riding ? 1 - st.dTurn * .3 : smooth(9, 4, Math.hypot(st.eye[0], st.eye[2] - (truckZ() + 1)));
      poseSkeleton(sk, sitPose({ t: t + 3, hip: 80 * D, knee: 22 * D, hunch: 16 * D, armDown: 66 * D, armFwdL: -22 * D, armFwdR: 10 * D, elbow: 14 * D, headPitch: 6 * D, neckYaw: watch * 38 * D, tilt: 10 * D * watch }));
      modelB = placeSitting(tm, [.6, .96, .5], -Math.PI / 2 + .35, SC * .72);
      skinB.set(sk.skin);
    }

    /* ---- camera ---- */
    function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
    function seatEye(t) { return M4.xform(truckMatrix(t), [SEAT_EYE[0], SEAT_EYE[1] + truckBounce(t) * .4, SEAT_EYE[2]]); }
    function updateCamera(t, dt) {
      let eye, yaw, pitch; st.camUp = null;
      if (st.phase === 'visit') {
        const p = st.p; eye = [p.x, 1.62 + Math.sin(t * 1.3) * .008, p.z];
        const h = st.a.head, dist = Math.hypot(h[0] - eye[0], h[2] - eye[2]);
        const near = st.a.role === 'walker' ? smooth(14, 4.5, dist) : 0;
        const tgt = [lerp(0, h[0], near), lerp(1.45, h[1] - .05, near), lerp(-10, h[2], near)];
        const dx = tgt[0] - eye[0], dy = tgt[1] - eye[1], dz = tgt[2] - eye[2];
        if (lookId === null) { st.dragYaw *= .985; st.dragPitch *= .985; }
        yaw = Math.atan2(dx, -dz) + st.dragYaw + Math.sin(t * 7.1) * .0015 + Math.sin(t * 3.3) * .002;
        pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)) + st.dragPitch + Math.sin(t * 1.3) * .006, -1.2, 1.2);
      } else if (controlling() || st.phase === 'door' || st.phase === 'done') {
        const p = st.p, pk = clamp((t - st.punchT) / .26, 0, 1), punch = Math.sin(Math.PI * pk) * .16 * (pk < 1 ? 1 : 0);
        const shake = pk < 1 ? Math.sin(t * 70) * .01 * (1 - pk) : 0;
        const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        eye = [p.x + fx * punch, 1.62 + Math.sin(p.bob * 2) * .035 * p.moving + shake, p.z + fz * punch];
        yaw = p.yaw + shake * .5; pitch = p.pitch;
      } else if (st.phase === 'hop') {
        const k = clamp((t - st.hopT) / 1.1, 0, 1), e = k * k * (3 - 2 * k), f = st.hopFrom, se = seatEye(t);
        eye = [lerp(f.x, se[0], e), lerp(f.y, se[1], e) + Math.sin(Math.PI * k) * .55, lerp(f.z, se[2], e)];
        yaw = lerpAngle(f.yaw, 0, e); pitch = lerp(f.pitch, -.06, e);
        if (k >= 1) { st.phase = 'ride'; st.rideStart = t; st.rc = 0; st.dragYaw = 0; st.dragPitch = 0; sfx.thud(); }
      } else if (st.phase === 'ride') {
        eye = seatEye(t); yaw = st.dragYaw; pitch = clamp(-.06 + st.dragPitch, -1, 1);
      } else if (st.phase === 'crash') {
        const tm = truckMatrix(t), k = t - st.boomT, sh = Math.exp(-k * 1.5) * .06;
        eye = M4.xform(tm, [SEAT_EYE[0] + Math.sin(t * 53) * sh, SEAT_EYE[1] + Math.sin(t * 61) * sh, SEAT_EYE[2]]);
        const o = M4.xform(tm, [0, 0, 0]), fw = M4.xform(tm, [0, -.18, -1]), up = M4.xform(tm, [0, 1, 0]);
        const f = [fw[0] - o[0], fw[1] - o[1], fw[2] - o[2]];
        yaw = Math.atan2(f[0], -f[2]); pitch = Math.atan2(f[1], Math.hypot(f[0], f[2]));
        st.camUp = [up[0] - o[0], up[1] - o[1], up[2] - o[2]];
      } else if (st.phase === 'wake') {
        const k = t - st.wakeT, p = st.p;
        eye = [p.x, lerp(.32, 1.62, smooth(2.4, 4.6, k)), p.z + lerp(.5, 0, smooth(2.4, 4.6, k))];
        if (lookId === null) { st.dragYaw *= .99; st.dragPitch *= .99; }
        yaw = st.dragYaw + Math.sin(t * .7) * .03 * (1 - smooth(2, 5, k)); pitch = clamp(lerp(1.15, -.05, smooth(1.6, 4.4, k)) + st.dragPitch, -1.2, 1.4);
        if (k > 4.8) { st.camYaw = yaw; st.camPitch = pitch; st.eye = eye; beginExplore(); }
      } else if (st.phase === 'caught' || st.phase === 'dead') {
        const p = st.p, k = t - st.caughtT, sh = .04 * Math.exp(-k * .8);
        eye = [p.x + Math.sin(t * 47) * sh, 1.62 + Math.sin(t * 59) * sh, p.z];
        const tx = mon.x, tz = mon.z, dx = tx - eye[0], dz = tz - eye[2];
        yaw = lerpAngle(st.camYaw, Math.atan2(dx, -dz), Math.min(1, dt * 10)); pitch = lerp(st.camPitch, .32, Math.min(1, dt * 6));
      } else {
        eye = st.eye; yaw = st.camYaw; pitch = st.camPitch;
      }
      st.eye = eye; st.camYaw = yaw; st.camPitch = pitch;
    }

    /* ---- render loop ---- */
    let raf = 0, alive = true, emaDt = 1 / 60, resScale = 1, lastScaleT = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale;
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    const I = M4.ident();
    function frame(t, noDraw) {
      const dt = clamp(t - st.t, 0, .1); st.t = t;
      if (!noDraw && dt > 0) { emaDt = lerp(emaDt, dt, .05); if (t - lastScaleT > 1.5 && emaDt > .036 && resScale > .55) { resScale *= .85; lastScaleT = t; } }
      for (let n = 0; n < 50; n++) { let k = -1; for (let i = 0; i < st.timers.length; i++) if (t >= st.timers[i].at && (k < 0 || st.timers[i].at < st.timers[k].at)) k = i; if (k < 0) break; const f = st.timers[k].fn; st.timers.splice(k, 1); f(); }   // earliest first, even on a slow frame
      if (st.toastUntil && t > st.toastUntil) { hud.toast.classList.remove('show'); st.toastUntil = 0; }

      if (st.area === 1) { updateA(t, dt); updateRide(t, dt); updateCrash(dt); }
      updatePlayer(t, dt);
      updateMonster(t, dt);
      if (st.area === 1) poseCitizens(t, dt);
      updateCamera(t, dt);
      const talk = envAt(A.voice, envVoice);
      updateLights(t, talk);

      // sounds that follow the scene
      sfx.setHum(st.area === 1 ? 1 - lampLevel[0] + (lampLevel[2] < .5 ? .6 : 0) : (flick2 < .5 ? .8 : .2));
      const sirenOn = st.area === 1 && (st.phase === 'alarm' || st.phase === 'hop' || st.phase === 'ride') ? 1 : 0;
      sfx.siren(env.am * sirenOn * (1 - env.tun * .8), t);
      const riding = st.phase === 'ride' || st.phase === 'hop';
      const dTruck = Math.hypot(st.eye[0], st.eye[2] - (truckZ() - 1));
      sfx.engine(st.area !== 1 || st.phase === 'crash' ? 0 : riding ? .75 + st.truckV / 18 : clamp(1 - dTruck / 16, 0, 1) * .5, st.truckV / 9);
      sfx.water(st.area === 2 && st.inSewer && st.phase !== 'done' ? 1 : 0);

      if (noDraw) return;
      resize();
      const asp = canvas.width / canvas.height;
      const vfov = clamp(2 * Math.atan(Math.tan(31 * D) / asp), 58 * D, 92 * D);
      const eye = st.eye, yaw = st.camYaw, pitch = st.camPitch;
      const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const look3 = [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]];
      const up = st.camUp || [0, 1, 0];
      const view = opts.debugCam ? M4.lookAt(opts.debugCam.eye, opts.debugCam.target, [0, 1, 0]) : M4.lookAt(eye, look3, up);
      const VP = M4.mul(M4.persp(vfov, asp, .05, 120), view);
      const camPos = opts.debugCam ? opts.debugCam.eye : eye;
      let amb, fogC, fogD;
      if (st.area === 1) {
        const { am, pulse, tun, out } = env;
        amb = mix3(mix3(mix3([.05, .055, .06], [.05, .045, .04], tun), [.05, .06, .085], out), sc3([.16, .02, .015], .7 + .3 * pulse), am);
        fogC = mix3(mix3(mix3([.008, .008, .01], [.035, .028, .022], tun), [.02, .026, .04], out), sc3([.07, .004, .003], .7 + .3 * pulse), am);
        fogD = lerp(lerp(.075, .045, tun), .022, out);
      } else if (!st.inSewer) { amb = [.035, .033, .032]; fogC = [.006, .006, .006]; fogD = .08; }
      else { amb = [.022, .028, .024]; fogC = [.005, .008, .006]; fogD = .08; }
      // flashlight
      const rightV = [Math.cos(yaw), 0, Math.sin(yaw)];
      const lightOn = st.area === 2 && st.hasLight && st.phase !== 'dead';
      const spotPos = [eye[0] + rightV[0] * .16, eye[1] - .14, eye[2] + rightV[2] * .16];
      const spotCol = lightOn ? sc3([3.6, 3.45, 3.0], .93 + .07 * Math.sin(t * 13)) : [0, 0, 0];

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      const common = pg => {
        gl.useProgram(pg.p);
        gl.uniformMatrix4fv(pg.u.uVP, false, VP); gl.uniform3fv(pg.u.uCam, camPos);
        gl.uniform3fv(pg.u.uAmb, amb); gl.uniform3fv(pg.u.uFogCol, fogC); gl.uniform1f(pg.u.uFogDen, fogD);
        gl.uniform3fv(pg.u.uLPos, Lpos); gl.uniform3fv(pg.u.uLCol, Lcol); gl.uniform1fv(pg.u.uLRange, Lrange); gl.uniform1i(pg.u.uLCount, Ln);
        gl.uniform1i(pg.u.uMode, 0); gl.uniform1f(pg.u.uAlpha, 1); gl.uniform1f(pg.u.uSkinNoise, 0); gl.uniform3f(pg.u.uEmissive, 0, 0, 0);
        gl.uniform1f(pg.u.uTime, t);
        gl.uniform3fv(pg.u.uSpotPos, spotPos); gl.uniform3fv(pg.u.uSpotDir, fwd); gl.uniform3fv(pg.u.uSpotCol, spotCol); gl.uniform2f(pg.u.uSpotCos, Math.cos(14 * D), Math.cos(28 * D));
      };
      common(progW);
      gl.uniformMatrix4fv(progW.u.uModel, false, I);
      gl.uniform1i(progW.u.uFlip, 1); gl.uniform1i(progW.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
      const draw = (m, color, o = {}) => {
        gl.uniform3fv(progW.u.uColor, color);
        gl.uniform1i(progW.u.uUseTex, o.tex ? 1 : 0); if (o.tex) gl.bindTexture(gl.TEXTURE_2D, o.tex);
        gl.uniform1f(progW.u.uSpec, o.spec || 0); gl.uniform1f(progW.u.uShine, o.shine || 24);
        gl.uniform3fv(progW.u.uEmissive, o.em || [0, 0, 0]);
        if (o.mode) gl.uniform1i(progW.u.uMode, o.mode);
        if (o.model) gl.uniformMatrix4fv(progW.u.uModel, false, o.model);
        gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        if (o.model) gl.uniformMatrix4fv(progW.u.uModel, false, I);
        if (o.mode) gl.uniform1i(progW.u.uMode, 0);
      };
      const glows = [];
      const lampAvg = (lampLevel[0] + lampLevel[1] + lampLevel[2] + lampLevel[3]) / 4;
      const { am, pulse } = env;
      let tm = null, tb = 0;
      if (st.area === 1) {
        const bulbCol = mix3(sc3([1.6, 1.25, .85], lampAvg), sc3([2.2, .15, .08], .5 + .5 * pulse), am);
        draw(M.floor, [1, 1, 1], { tex: texFloor, spec: .35, shine: 40 });
        draw(M.ceil, [.35, .34, .33], { tex: texFloor });
        draw(M.wall, [1, 1, 1], { tex: texWall, spec: .05 });
        draw(M.metal, [.2, .2, .21], { spec: .9, shine: 48 });
        draw(M.dark, [.08, .08, .08], { spec: .5, shine: 30 });
        draw(M.cloth, [.28, .25, .2]);
        draw(M.gfloor, [.62, .6, .57], { tex: texFloor, spec: .25, shine: 30 });
        draw(M.concrete, [.5, .49, .47], { tex: texFloor });
        draw(M.asphalt, [.3, .29, .28], { tex: texFloor, spec: .15, shine: 20 });
        draw(M.wood, [.7, .48, .26], { tex: texFloor });
        draw(M.drum, [.42, .12, .07], { spec: .4, shine: 30 });
        draw(M.paint, [.8, .66, .16], { em: [.05, .04, .01] });
        draw(M.rock, [.16, .16, .17], { tex: texFloor });
        draw(M.mine, [.12, .13, .11], { spec: .8, shine: 40 });
        const blink = (t % .8) < .4 ? 1 : 0;
        draw(M.mineled, [0, 0, 0], { em: [2.5 * blink, .1 * blink, .05 * blink] });
        draw(M.bulbs, [0, 0, 0], { em: bulbCol });
        draw(M.tubes, [0, 0, 0], { em: mix3([1.3, 1.45, 1.6], [2.4 * pulse, .1, .05], am) });
        draw(M.beacon, [.25, .02, .02], { em: [2.5 * am * (.4 + .6 * pulse), .1 * am, .05 * am] });
        draw(M.tlamp, [0, 0, 0], { em: [1.8, 1.5, 1.05] });
        draw(M.sodium, [0, 0, 0], { em: [2.0, .9, .25] });
        let doorModel;
        if (st.fallT >= 0) {
          const k = clamp((t - st.fallT) / .55, 0, 1), bounce = k >= 1 ? Math.abs(Math.sin((t - st.fallT - .55) * 18)) * Math.exp(-(t - st.fallT - .55) * 9) * .12 : 0;
          doorModel = M4.trs([0, .03 * k, Z_BARS - .05], Q.aa(1, 0, 0, -(Math.PI / 2) * (k * k) + bounce), [1, 1, 1]);
        } else {
          const ks = t - st.shakeT, sh = ks < 1 ? Math.sin(ks * 60) * Math.exp(-ks * 8) * .035 : 0;
          doorModel = M4.trs([sh * .5, 0, Z_BARS], Q.aa(1, 0, 0, sh), [1, 1, 1]);
        }
        draw(doorM, [.2, .2, .21], { spec: .9, shine: 48, model: doorModel });
        const gdy = st.rideStart < 0 ? 0 : smooth(st.rideStart + 1.6, st.rideStart + 4.0, t) * 3.55;
        draw(gdoorM, [.3, .31, .3], { spec: .5, shine: 30, model: M4.trs([0, gdy, 0], [0, 0, 0, 1], [1, 1, 1]) });
        tm = truckMatrix(t); tb = truckBounce(t);
        draw(TM.body, [.09, .12, .1], { spec: .55, shine: 36, model: tm });
        draw(TM.trim, [.16, .16, .17], { spec: .9, shine: 50, model: tm });
        draw(TM.seat, [.32, .2, .13], { model: tm });
        draw(TM.bed, [.42, .31, .2], { tex: texFloor, model: tm });
        const lightsOut = st.boomT >= 0 && t - st.boomT > .8;
        draw(TM.lights, [0, 0, 0], { em: lightsOut ? [.05, .05, .04] : [2.2, 2.0, 1.6], model: tm });
        draw(TM.tail, [0, 0, 0], { em: [1.6, .08, .05], model: tm });
        for (const w of WHEELS) {
          const wm = M4.mul(tm, M4.trs([w[0], w[1] + tb * .3, w[2]], Q.aa(1, 0, 0, -st.truckDist / .45 - (st.crash ? (t - st.boomT) * 20 : 0)), [1, 1, 1]));
          draw(WM.tire, [.04, .04, .04], { spec: .2, shine: 12, model: wm });
          draw(WM.hub, [.2, .2, .2], { spec: .8, shine: 40, model: wm });
        }
        // citizens
        common(progS);
        gl.uniform1i(progS.u.uFlip, 0); gl.uniform1i(progS.u.uUseTex, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, boneTex); gl.uniform1i(progS.u.uBones, 1);
        gl.bindVertexArray(cvao);
        for (const [model, skin] of [[modelA, skinA], [modelB, skinB]]) {
          gl.uniformMatrix4fv(progS.u.uModel, false, model);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, sk.joints.length, gl.RGBA, gl.FLOAT, skin);
          gl.uniform3f(progS.u.uColor, .40, .60, .54); gl.uniform1f(progS.u.uSpec, .28); gl.uniform1f(progS.u.uShine, 22); gl.uniform1f(progS.u.uSkinNoise, .22);
          gl.drawElements(gl.TRIANGLES, meta.bodyIndexCount, gl.UNSIGNED_SHORT, 0);
          gl.uniform3f(progS.u.uColor, .005, .005, .006); gl.uniform1f(progS.u.uSpec, 2.2); gl.uniform1f(progS.u.uShine, 90); gl.uniform1f(progS.u.uSkinNoise, 0);
          gl.drawElements(gl.TRIANGLES, meta.eyeIndexCount, gl.UNSIGNED_SHORT, meta.bodyIndexCount * 2);
        }
        gl.activeTexture(gl.TEXTURE0);
        // glows
        const gWarm = [1, .8, .55], gRed = [1, .08, .05];
        glows.push([[0, H - .23, 3.1], .7, mix3(gWarm, gRed, am), lerp(.7, .8 * pulse, am)]);
        for (let i = 0; i < 4; i++) glows.push([[0, 2.6, LAMPS_Z[i]], 1.3, mix3(gWarm, gRed, am), lerp(.9 * lampLevel[i], .9 * (.4 + .6 * pulse), am)]);
        for (const z of [-19.5, -31]) glows.push([[0, GH - .2, z], 1.8, mix3([.75, .85, 1], gRed, am), lerp(.45, .9 * pulse, am)]);
        for (let i = 0; i < 4; i++) glows.push([[BEACONS[i][0] - Math.sign(BEACONS[i][0]) * .1, 3.5, BEACONS[i][1]], 1.6, gRed, am * (.5 + .5 * Math.abs(Math.sin(t * 4 + i)))]);
        for (const s of [-1, 1]) { if (!lightsOut) glows.push([M4.xform(tm, [s * .8, 1.25, -2.98]), 1.1, [1, .9, .7], .9]); glows.push([M4.xform(tm, [s * .92, .98, 2.76]), .45, gRed, .7]); }
        for (const z of TUN_LAMPS) glows.push([[-TW + 1.35, 3.42, z], 1.4, gWarm, .85]);
        for (const z of SODIUM) glows.push([[TW - .2, 2.8, z], 1.2, [1, .5, .15], .8]);
        for (const [s, z] of BR_LAMPS) glows.push([[s * (TW + .15) - s * 1.3, 4.85, z], 2.2, [1, .55, .2], .9]);
        if (st.boomT < 0) for (const [x, z] of MINES) glows.push([[x, .12, z], .35, gRed, .8 * blink]);
        if (st.boomT >= 0) {   // fireball
          const k = t - st.boomT;
          for (let i = 0; i < 6; i++) {
            const kk = k - i * .05; if (kk < 0 || kk > 2.2) continue;
            const s = (2 + i * .9) * (1 - Math.exp(-kk * 5)), a = Math.exp(-kk * (1.6 + i * .2));
            glows.push([[Math.sin(i * 2.1) * .8 * kk, .6 + kk * (1.5 + i * .4), MINE_Z + Math.cos(i * 1.7) * .6], s, mix3([1, .95, .8], [1, .35, .08], clamp(kk * 1.5, 0, 1)), a]);
          }
        }
        // blob shadow under the visitor
        gl.useProgram(progW.p); gl.uniform1i(progW.u.uUseTex, 0); gl.uniform3fv(progW.u.uEmissive, [0, 0, 0]);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        if (shadowA) {
          gl.uniform1i(progW.u.uMode, 1); gl.uniform1f(progW.u.uAlpha, .55);
          gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs([shadowA[0], .012, shadowA[1]], Q.aa(0, 1, 0, st.a.yaw), [1.5, 1, 1.0]));
          gl.bindVertexArray(blob.vao); gl.drawElements(gl.TRIANGLES, blob.count, blob.type, 0);
        }
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniform1i(progW.u.uMode, 3); gl.uniformMatrix4fv(progW.u.uModel, false, I);
        gl.uniform3fv(progW.u.uColor, mix3(sc3([.09, .075, .055], lampAvg), sc3([.14, .01, .005], .5 + .5 * pulse), am)); gl.uniform1f(progW.u.uAlpha, 1);
        gl.bindVertexArray(M.cones.vao); gl.drawElements(gl.TRIANGLES, M.cones.count, M.cones.type, 0);
      } else {
        /* --- act 2 --- */
        draw(M2.floor, [.72, .7, .66], { tex: texFloor, spec: .2, shine: 30 });
        draw(M2.conc, [.42, .41, .39], { tex: texFloor });
        draw(M2.wall2, [.55, .53, .49], { tex: texFloor, spec: .05 });
        if (st.inSewer || st.eye[0] > 20) {
          draw(M2.brick, [1, 1, 1], { tex: texBrick, spec: .3, shine: 22 });
          draw(M2.water, [.05, .075, .055], { spec: 2.2, shine: 70, mode: 4 });
          draw(M2.sceil, [.24, .25, .23], { tex: texFloor });
          draw(M2.shaft, [.3, .3, .3], { tex: texFloor });
          draw(M2.sky, [0, 0, 0], { em: [1.4, 1.6, 1.9] });
          draw(M2.lamps, [0, 0, 0], { em: [1.8, 1.1, .5] });
        }
        draw(M2.metal, [.2, .2, .21], { spec: .9, shine: 48 });
        draw(M2.dark, [.06, .06, .06], { spec: .4, shine: 30 });
        draw(M2.wood, [.62, .43, .24], { tex: texFloor });
        draw(M2.cloth, [.3, .27, .22]);
        draw(M2.drum, [.36, .16, .07], { spec: .4, shine: 30 });
        draw(M2.rust, [.3, .16, .09], { tex: texFloor, spec: .3, shine: 26 });
        draw(M2.stripe, [.8, .65, .1]);
        draw(M2.bulbs2, [0, 0, 0], { em: sc3([1.8, 1.4, .9], flick2) });
        draw(M2.sign, [.9, .9, .9], { tex: texSign, em: [.08, .1, .08] });
        // the flashlight on its crate, or in your hand
        if (!st.hasLight && st.inSewer) {
          const fm = M4.trs(FLASH_POS, Q.aa(0, 1, 0, .6), [1.6, 1.6, 1.6]);
          draw(FLM.body, [.12, .12, .13], { spec: .9, shine: 50, model: fm });
          draw(FLM.lens, [0, 0, 0], { em: [.6, .65, .7], model: fm });
          glows.push([[FLASH_POS[0] + .15, FLASH_POS[1] + .05, FLASH_POS[2] + .1], .5, [.7, .8, 1], .45 + .25 * Math.sin(t * 3)]);
        }
        if (st.hasLight && st.phase !== 'dead') {
          const upv = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), Math.sin(pitch) * Math.cos(yaw)];
          const zx = [fwd[1] * upv[2] - fwd[2] * upv[1], fwd[2] * upv[0] - fwd[0] * upv[2], fwd[0] * upv[1] - fwd[1] * upv[0]];
          const bob = Math.sin(st.p.bob * 2) * .012 * st.p.moving;
          const o = [eye[0] + fwd[0] * .5 + rightV[0] * .27 - upv[0] * (.27 + bob), eye[1] + fwd[1] * .5 - upv[1] * (.27 + bob), eye[2] + fwd[2] * .5 + rightV[2] * .27 - upv[2] * (.27 + bob)];
          const vs = .75, vm = new Float32Array([fwd[0] * vs, fwd[1] * vs, fwd[2] * vs, 0, upv[0] * vs, upv[1] * vs, upv[2] * vs, 0, zx[0] * vs, zx[1] * vs, zx[2] * vs, 0, o[0], o[1], o[2], 1]);
          draw(FLM.body, [.1, .1, .11], { spec: .9, shine: 50, model: vm, em: [.02, .02, .02] });
          draw(FLM.lens, [0, 0, 0], { em: [2.2, 2.2, 2], model: vm });
        }
        // Clawrenzo
        if (claw && st.inSewer && mon.state !== 'off' && mon.state !== 'away') {
          const once = mon.clip === 'shock' || mon.clip === 'scare';
          claw.setPose(mon.clip, mon.animT, once);
          const model = M4.mul(M4.trs([mon.x, 0, mon.z], Q.aa(0, 1, 0, mon.yaw), [CLAW_SC, CLAW_SC, CLAW_SC]), M4.trs([0, 0, -CLAW_BODY], [0, 0, 0, 1], [1, 1, 1]));
          common(progS);
          claw.draw(progS, model, 1);
          gl.useProgram(progW.p);
        }
        glows.push([[0, 2.45, 3], .8, [1, .8, .55], .7 * flick2], [[-.82, 2.3, -4], .6, [1, .8, .55], .55], [[-8.86, 2.93, -9.1], .5, [.5, 1, .6], .7]);
        if (st.inSewer) {
          for (const L of SEWER_LAMPS) { const p = lampPos(L); glows.push([p, .9, [1, .6, .28], .7]); }
          glows.push([[LADDER_X - .7, SH + 3.6, LADDER_Z], 3.5, [.7, .8, 1], .6]);
        }
        gl.useProgram(progW.p); gl.uniform1i(progW.u.uUseTex, 0); gl.uniform3fv(progW.u.uEmissive, [0, 0, 0]);
        gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE);
      }
      // additive glows
      gl.useProgram(progW.p); gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1i(progW.u.uMode, 2); gl.bindVertexArray(sprite.vao);
      for (const [p, size, c, a] of glows) {
        if (a <= .01) continue;
        const dx = camPos[0] - p[0], dz = camPos[2] - p[2]; if (dx * dx + dz * dz > 6400) continue;
        gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs(p, Q.aa(0, 1, 0, Math.atan2(dx, dz)), [size, size, size]));
        gl.uniform3fv(progW.u.uColor, c); gl.uniform1f(progW.u.uAlpha, a);
        gl.drawElements(gl.TRIANGLES, sprite.count, sprite.type, 0);
      }
      gl.uniform1i(progW.u.uMode, 0); gl.disable(gl.BLEND); gl.depthMask(true);
      gl.bindVertexArray(null);
    }

    let t0 = performance.now();
    function loop(now) { if (!alive) return; frame((now - t0) / 1000); raf = requestAnimationFrame(loop); }
    if (opts.debugSetup) opts.debugSetup(st, { beginFree, breakOut, getIn, startCrash, enterArea2, beginExplore, enterSewer, takeLight, monSpawn, startCaught, climbOut, mon, ensureClaw });
    if (opts.debugTime !== undefined) {
      const T0 = opts.debugFrom || 0;
      st.t = T0;
      for (let t = T0; t <= opts.debugTime; t += 1 / 30) frame(t, t + 1 / 30 <= opts.debugTime);
    } else { t0 = performance.now() - (opts.debugFrom || 0) * 1000; st.t = opts.debugFrom || 0; raf = requestAnimationFrame(loop); }

    return {
      stop() {
        alive = false; cancelAnimationFrame(raf); sfx.stop();
        hud.zone.removeEventListener('pointerdown', onZoneDown); canvas.removeEventListener('pointerdown', onCanvasDown);
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
        for (const el of [A.voice, A.borrowed, A.buckle, A.mines]) if (el) { try { el.pause(); el.onended = null; el.onplaying = null; } catch (e) {} }
        hud.root.remove();
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      },
      state: st, mon, _dbg: { beginFree, enterArea2, enterSewer, takeLight, monSpawn, startCrash, ensureClaw }, _frame: (t, nd) => frame(t, nd),
      _debug: { sk, walkPose, sitPose, poseSkeleton, AX, jointMeshPos: n => jointMeshPos(sk, n) }
    };
  }

  window.Chapter1 = { start, AX, _internals: { compile, VS_SKIN, VS_WORLD, FS, M4, Q, makeClaw, meshFromGeo, Geo } };
})();
