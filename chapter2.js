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
    if (!ac) return { step: none, pstep: none, setHum: none, clang: none, crash: none, thud: none, siren: none, engine: none, boom: none, ring: none, growl: none, clack: none, screech: none, scream: none, water: none, pickup: none, creak: none, splash: none, roar: none, rumble: none, lock: none, jump: none, land: none, glass: none, click: none, buzz: none, grind: none, scratch: none, squeal: none, charge: none, zap: none, snore: none, stop: none, wind: none, gust: none, fallRoar: none, whoosh: none };
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
    // rooftop wind: two band-passed noise layers; gusts swell the level and pitch
    const windSrc = ac.createBufferSource(); windSrc.buffer = nb; windSrc.loop = true; windSrc.playbackRate.value = .5;
    const wbp1 = ac.createBiquadFilter(); wbp1.type = 'bandpass'; wbp1.frequency.value = 380; wbp1.Q.value = .9;
    const wbp2 = ac.createBiquadFilter(); wbp2.type = 'bandpass'; wbp2.frequency.value = 1200; wbp2.Q.value = 2.5;
    const windG = ac.createGain(); windG.gain.value = 0; const windG2 = ac.createGain(); windG2.gain.value = 0;
    windSrc.connect(wbp1); wbp1.connect(windG); windG.connect(out); windSrc.connect(wbp2); wbp2.connect(windG2); windG2.connect(out); windSrc.start();
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
      wind(level, t, gust = 0) {
        const n = .5 + .3 * Math.sin(t * .37) + .2 * Math.sin(t * 1.13 + 1) + .15 * Math.sin(t * 2.9);   // slow wandering gusts
        const g = level * (.35 + .4 * n) + gust * .9, now = ac.currentTime;
        windG.gain.setTargetAtTime(g * .32, now, .15); windG2.gain.setTargetAtTime(g * g * .05, now, .15);
        wbp1.frequency.setTargetAtTime(260 + 260 * n + 500 * gust, now, .2); wbp2.frequency.setTargetAtTime(900 + 700 * n + 900 * gust, now, .2);
      },
      gust(power = 1) {   // a big rush of air
        if (!sfxOn()) return; const t = ac.currentTime;
        const src = ac.createBufferSource(); src.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
        f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1600, t + .9); f.frequency.exponentialRampToValueAtTime(400, t + 2.6);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9 * power, t + .5); g.gain.exponentialRampToValueAtTime(.001, t + 2.8);
        src.connect(f); f.connect(g); g.connect(sfx); src.start(t, Math.random()); src.stop(t + 2.9);
      },
      whoosh(vol = 1) {   // falling air rushing past
        if (!sfxOn()) return; const t = ac.currentTime;
        const src = ac.createBufferSource(); src.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .6;
        f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2200, t + 2.2);
        const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.8 * vol, t + 1.6); g.gain.linearRampToValueAtTime(0, t + 2.4);
        src.connect(f); f.connect(g); g.connect(sfx); src.start(t, Math.random()); src.stop(t + 2.5);
      },
      fallRoar(vol = 1) {   // a roar that drops away below you
        if (!sfxOn()) return; const t = ac.currentTime;
        for (const [f0, ty, gv] of [[150, 'sawtooth', .45], [96, 'square', .2]]) {
          const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o.type = ty;
          o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * .32, t + 2.6);
          f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + 2.6);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gv * vol, t + .15); g.gain.exponentialRampToValueAtTime(.001, t + 2.8);
          o.connect(f); f.connect(g); g.connect(sfx); o.start(t); o.stop(t + 2.9);
        }
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
      stop() { out.gain.setTargetAtTime(0, ac.currentTime, .3); setTimeout(() => { try { noise.stop(); hum.stop(); so1.stop(); so2.stop(); eo1.stop(); eo2.stop(); wsrc.stop(); ringO.stop(); windSrc.stop(); out.disconnect(); } catch (e) {} }, 1500); }
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

  /* ================= posable rigged model (skeleton posed in code) ================= */
  function makeRig(gl, data) {
    const meta = data.meta, raw = atob(data.b64), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const buf = bytes.buffer, ST = meta.stride;
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, 0, meta.vbytes), gl.STATIC_DRAW);
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(buf, meta.vbytes, meta.ibytes), gl.STATIC_DRAW);
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
    const rig = { meta, texReady: 0 };
    const texs = {};
    for (const k in data.tex) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      texs[k] = t;
      const im = new Image();
      im.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        rig.texReady++;
      };
      im.src = 'data:image/jpeg;base64,' + data.tex[k];
    }
    const joints = meta.joints, J = joints.length, ROOT = new Float32Array(meta.root), IBM = meta.ibm.map(m => new Float32Array(m));
    const byName = {}; joints.forEach((jn, i) => { byName[jn.name] = i; });
    const G = new Array(J), skin = new Float32Array(J * 16);
    const boneTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, boneTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, J, 0, gl.RGBA, gl.FLOAT, null);
    // deltas: { boneName: quaternion applied in the bone's own frame }
    function setPose(deltas) {
      for (let i = 0; i < J; i++) {
        const jn = joints[i], dq = deltas && deltas[jn.name];
        const L = M4.trs(jn.t, dq ? Q.mul(jn.r, dq) : jn.r, jn.s);
        G[i] = M4.mul(jn.parent < 0 ? ROOT : G[jn.parent], L);
        skin.set(M4.mul(G[i], IBM[i]), i * 16);
      }
    }
    // ---- baked animation clips: setAnim([[clip, time, weight, once], ...], deltas) ----
    const CL = {}, cOff = meta.vbytes + meta.ibytes;
    for (const name in (meta.clips || {})) {
      const c = meta.clips[name], tr = []; for (let i = 0; i < J; i++) tr.push([null, null, null]);
      for (const [jk, path, n, off] of c.tracks) { const nc = path === 1 ? 4 : 3; tr[jk][path] = { n, a: new Float32Array(buf.slice(cOff + off, cOff + off + n * nc * 4)) }; }
      CL[name] = { fps: c.fps, frames: c.frames, dur: c.dur, tr };
    }
    const _t = [0, 0, 0], _r = [0, 0, 0, 0], _s = [0, 0, 0];
    function setAnim(layers, deltas) {
      const fr = layers.map(([name, time, w, once]) => {
        const c = CL[name], nf = c.frames, per = Math.max(1, nf - 1); let ft = time * c.fps;
        ft = once ? Math.max(0, Math.min(nf - 1, ft)) : ((ft % per) + per) % per;
        const f0 = Math.floor(ft); return { c, f0, f1: Math.min(f0 + 1, nf - 1), u: ft - f0, w };
      });
      for (let i = 0; i < J; i++) {
        const jn = joints[i]; _t[0] = _t[1] = _t[2] = 0; _s[0] = _s[1] = _s[2] = 0; _r[0] = _r[1] = _r[2] = _r[3] = 0; let ws = 0, ref = null;
        for (const L of fr) {
          const tk = L.c.tr[i], w = L.w; ws += w;
          for (let p = 0; p < 3; p++) {
            const nc = p === 1 ? 4 : 3, rest = p === 0 ? jn.t : p === 1 ? jn.r : jn.s, k = tk[p], acc = p === 0 ? _t : p === 1 ? _r : _s;
            let v0 = rest, v1 = rest, u = 0, o0 = 0, o1 = 0;
            if (k) { v0 = v1 = k.a; if (k.n > 1) { o0 = L.f0 * nc; o1 = L.f1 * nc; u = L.u; } }
            let sg = 1;
            if (p === 1) {
              const x = v0[o0] + (v1[o1] - v0[o0]) * u, y = v0[o0 + 1] + (v1[o1 + 1] - v0[o0 + 1]) * u, z = v0[o0 + 2] + (v1[o1 + 2] - v0[o0 + 2]) * u, ww = v0[o0 + 3] + (v1[o1 + 3] - v0[o0 + 3]) * u;
              if (!ref) ref = [x, y, z, ww]; else if (x * ref[0] + y * ref[1] + z * ref[2] + ww * ref[3] < 0) sg = -1;
              acc[0] += sg * w * x; acc[1] += sg * w * y; acc[2] += sg * w * z; acc[3] += sg * w * ww;
            } else for (let c = 0; c < nc; c++) acc[c] += w * (v0[o0 + c] + (v1[o1 + c] - v0[o0 + c]) * u);
          }
        }
        const iw = 1 / (ws || 1), rl = Math.hypot(_r[0], _r[1], _r[2], _r[3]) || 1;
        let r = [_r[0] / rl, _r[1] / rl, _r[2] / rl, _r[3] / rl];
        const dq = deltas && deltas[jn.name]; if (dq) r = Q.mul(r, dq);
        const Lm = M4.trs([_t[0] * iw, _t[1] * iw, _t[2] * iw], r, [_s[0] * iw, _s[1] * iw, _s[2] * iw]);
        G[i] = M4.mul(jn.parent < 0 ? ROOT : G[jn.parent], Lm);
        skin.set(M4.mul(G[i], IBM[i]), i * 16);
      }
    }
    // pose with rotations given in the model's own axes: { bone: quaternion }, each relative to its parent's motion
    let RR = null;
    function quatOf(m) {
      const ax = Math.hypot(m[0], m[1], m[2]), ay = Math.hypot(m[4], m[5], m[6]), az = Math.hypot(m[8], m[9], m[10]);
      const a = m[0] / ax, b = m[4] / ay, c = m[8] / az, d = m[1] / ax, e = m[5] / ay, f = m[9] / az, g = m[2] / ax, h = m[6] / ay, k = m[10] / az;
      const tr = a + e + k; let x, y, z, w;
      if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; w = .25 * S; x = (h - f) / S; y = (c - g) / S; z = (d - b) / S; }
      else if (a > e && a > k) { const S = Math.sqrt(1 + a - e - k) * 2; w = (h - f) / S; x = .25 * S; y = (b + d) / S; z = (c + g) / S; }
      else if (e > k) { const S = Math.sqrt(1 + e - a - k) * 2; w = (c - g) / S; x = (b + d) / S; y = .25 * S; z = (f + h) / S; }
      else { const S = Math.sqrt(1 + k - a - e) * 2; w = (d - b) / S; x = (c + g) / S; y = (f + h) / S; z = .25 * S; }
      return [x, y, z, w];
    }
    function worldDeltas(spec) {
      if (!RR) { setPose(null); RR = G.map(quatOf); }
      const d = {};
      for (const k in spec) { const i = byName[k]; if (i === undefined) continue; const r = RR[i], rc = [-r[0], -r[1], -r[2], r[3]]; d[k] = Q.mul(rc, Q.mul(spec[k], r)); }
      return d;
    }
    const clipDur = name => CL[name] ? CL[name].dur : 0;
    const jointPos = name => { const g = G[byName[name]]; return [g[12], g[13], g[14]]; };
    function draw(pg, model, opts = {}) {
      gl.uniformMatrix4fv(pg.u.uModel, false, model);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, boneTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, J, gl.RGBA, gl.FLOAT, skin);
      gl.uniform1i(pg.u.uBones, 1); gl.uniform1i(pg.u.uFlip, 1); gl.uniform1f(pg.u.uSkinNoise, 0);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pg.u.uTex, 0);
      for (const p of prims) {
        const tex = p.tex >= 0 ? texs[p.tex] : null;
        gl.uniform1i(pg.u.uUseTex, tex ? 1 : 0); if (tex) gl.bindTexture(gl.TEXTURE_2D, tex);
        const tint = (opts.tint && opts.tint[p.name]) || [1, 1, 1];
        gl.uniform3fv(pg.u.uColor, tex ? tint : p.color);
        gl.uniform3fv(pg.u.uEmissive, (opts.emissive && opts.emissive[p.name]) || [0, 0, 0]);
        const sp = (opts.spec && opts.spec[p.name]) || [.3, 24];
        gl.uniform1f(pg.u.uSpec, sp[0]); gl.uniform1f(pg.u.uShine, sp[1]);
        gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.icount, gl.UNSIGNED_SHORT, p.istart * 2);
      }
      gl.uniform3fv(pg.u.uEmissive, [0, 0, 0]);
      gl.bindVertexArray(null);
    }
    setPose(null);
    return Object.assign(rig, { setPose, setAnim, clipDur, draw, jointPos, byName, worldDeltas });
  }

  /* ================= static baked model (positions + normals, one colour) ================= */
  function makeStatic(gl, data) {
    const meta = data.meta, raw = atob(data.b64), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const n = meta.count, buf = bytes.buffer;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, 0, n * 24), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, n * 12);
    gl.disableVertexAttribArray(2);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(buf, n * 24, meta.icount * 4), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { meta, vao, count: meta.icount, type: gl.UNSIGNED_INT };
  }

  /* ================= chapter 2: hallway, rooftops, the gap, the sheriff's room ================= */
  const HW = 1.6, HH = 3.4, Z_HBACK = 4, Z_HEND = -26;        // hallway
  const RB_Y = 1.1;                                           // roof B and C height
  const GAP0 = -72, GAP1 = -80;                               // the gap between roof B and roof C
  const ROOM = { x0: -3, x1: 3, z0: -101, z1: -94, h: 3.5 };
  const ROOM_EDGE = -101.2;                                    // the building ends right behind the room: the window looks over a drop
  const WIN = { x0: -1.0, x1: 1.0, y0: 1.1 + .75, y1: 1.1 + 2.85 };
  const FRONT_BREAK = [[-1.3, -.6, -94.2, -93.95, 99], [.6, 1.3, -94.2, -93.95, 99]];   // wall beside the door that Banban smashes
  const STREET = -30;
  // floors you can stand on: [x0, x1, z0, z1, y]
  const FLOORS = [[-HW, HW, Z_HEND, Z_HBACK, 0], [-5, 5, -52, Z_HEND, 0], [-4.5, 4.5, GAP0, -52, RB_Y], [-5, 5, ROOM_EDGE, GAP1, RB_Y]];
  // obstacles: [x0, x1, z0, z1, top]; anything with a low top can be jumped onto / over
  const JUNK = [
    [-HW, .15, -11, -9.6, 1.7], [-.15, HW, -15, -13.6, 1.5], [-HW, HW, -18.4, -18.0, .62], [-HW, .2, -22.5, -21.2, 1.25],
    [-3.5, -1.5, -31, -29.5, 1.3], [.5, 3, -35, -33, 1.4], [-1.2, .2, -40, -38.8, 1.7], [-5, 5, -44.25, -43.95, .55],
    [2, 4.5, -49, -46.5, 3.6], [-4.6, -2.6, -48, -46, 1.2],
    [-3.5, -1.5, -57, -55.5, RB_Y + 1.5], [.5, 2.5, -61, -59.5, RB_Y + 1.2], [-1.5, 0, -66, -64.5, RB_Y + 2.0],
    [-4.4, -2.4, -90, -88, RB_Y + 1.1], [3.0, 4.6, -93.6, -91.8, RB_Y + 1.3]
  ];
  const WALL_TOP = 99;
  function buildSolidsC2() {
    const s = [
      [-HW - .3, -HW, Z_HEND, Z_HBACK, WALL_TOP], [HW, HW + .3, Z_HEND, Z_HBACK, WALL_TOP],
      [-.78, .78, 1.3, 2.7, WALL_TOP],                                                  // the hole with the ladder
      [-HW, HW, Z_HBACK, Z_HBACK + .3, WALL_TOP],                                       // wall behind (until it breaks)
      [-HW, -.7, Z_HEND - .3, Z_HEND, WALL_TOP], [.7, HW, Z_HEND - .3, Z_HEND, WALL_TOP],
      [-5.3, -5, -52, Z_HEND, WALL_TOP], [5, 5.3, -52, Z_HEND, WALL_TOP],                // roof A parapets
      [-5, -4.5, -52.2, -51.9, WALL_TOP], [4.5, 5, -52.2, -51.9, WALL_TOP],
      [-4.5, 4.5, -53, -51.9, RB_Y],                                                    // face of roof B: jump up
      [-4.8, -4.5, GAP0, -52, WALL_TOP], [4.5, 4.8, GAP0, -52, WALL_TOP],
      [-5.3, -5, ROOM_EDGE, GAP1, WALL_TOP], [5, 5.3, ROOM_EDGE, GAP1, WALL_TOP], [-5, ROOM.x0, ROOM_EDGE, ROOM_EDGE + .3, WALL_TOP], [ROOM.x1, 5, ROOM_EDGE, ROOM_EDGE + .3, WALL_TOP],
      // the sheriff's room (door gap at x -.6..6 in the front wall)
      [ROOM.x0, -1.3, ROOM.z1 - .2, ROOM.z1 + .05, WALL_TOP], [1.3, ROOM.x1, ROOM.z1 - .2, ROOM.z1 + .05, WALL_TOP],
      [ROOM.x0 - .2, ROOM.x0, ROOM.z0, ROOM.z1, WALL_TOP], [ROOM.x1, ROOM.x1 + .2, ROOM.z0, ROOM.z1, WALL_TOP], [ROOM.x0, ROOM.x1, ROOM.z0 - .2, ROOM.z0, WALL_TOP]
    ];
    return s.concat(JUNK);
  }
  const EDGE_BAR = [-4.5, 4.5, GAP0 - .1, GAP0 + .35, WALL_TOP];   // invisible until you leap
  const BACKWALL_I = 3;                                             // index of the breakable wall in the solids
  // skyline: [x0, x1, z0, z1, top]
  const SKYLINE = [
    [-6, 6, Z_HEND, 10, 9], [-5.5, 5.5, -52, Z_HEND, 0], [-5, 5, GAP0, -52, RB_Y], [-5.5, 5.5, ROOM_EDGE, GAP1, RB_Y],
    [-22, -7, -20, 8, 14], [-20, -8, -44, -24, 6], [-24, -9, -70, -48, 11], [-21, -9, -96, -74, -3], [-26, -8, -125, -100, 17],
    [7, 21, -16, 6, 5], [8, 23, -40, -20, 16], [8, 19, -62, -44, -6], [9, 25, -90, -66, 8], [8, 22, -122, -96, 3],
    [-12, 14, -150, -128, 24], [-40, -28, -110, -20, 30], [30, 44, -100, -10, 26]
  ];
  const ROOF_LAMPS = [[4.6, 0, -30], [-4.6, 0, -45], [4.2, RB_Y, -62], [-4.2, RB_Y, -70.6], [4.6, RB_Y, -82], [-4.6, RB_Y, -88], [4.6, RB_Y, -99]];
  const HALL_LAMPS = [[3, -1], [-1, 1], [-7, -1], [-13, 1], [-19, -1], [-25, 1]];
  // 12 chunks of the wall Banban bursts through
  const CHUNKS = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) CHUNKS.push([-HW + c * .8 + .4, r * (HH / 3) + HH / 6, Z_HBACK + .12]);
  // pieces of the room's front wall: [x, y, z, sx, sy]
  const FRONT_CHUNKS = [[-1.1, RB_Y + .6, -94, .4, 1.1], [-.95, RB_Y + 1.8, -94, .7, 1.1], [-.9, RB_Y + 2.9, -94, .8, 1.1], [1.1, RB_Y + .6, -94, .4, 1.1], [.95, RB_Y + 1.8, -94, .7, 1.1], [.9, RB_Y + 2.9, -94, .8, 1.1], [0, RB_Y + 2.6, -94, .8, .6], [0, RB_Y + 3.2, -94, 1.2, .6]];

  function buildWorldC2() {
    const g = {};
    for (const k of ['hfloor', 'hwall', 'hceil', 'metal', 'dark', 'wood', 'cloth', 'rust', 'roof', 'parapet', 'facade', 'bulbs', 'sodium', 'pit', 'room', 'roomfloor', 'warm', 'beacon', 'drum', 'rfront', 'rfmetal', 'rfwarm', 'winbars'])
      g[k] = new Geo();
    const WU = 2.4, CU = 2.6, FU = 6;
    /* --- hallway --- */
    g.hfloor.qy(-HW, HW, Z_HEND, 1.3, 0, true, 2); g.hfloor.qy(-HW, HW, 2.7, Z_HBACK, 0, true, 2);
    g.hfloor.qy(-HW, -.78, 1.3, 2.7, 0, true, 2); g.hfloor.qy(.78, HW, 1.3, 2.7, 0, true, 2);
    g.hceil.qy(-HW, HW, Z_HEND, Z_HBACK, HH, false, 2.6);
    g.hwall.qx(-HW, Z_HEND, Z_HBACK, 0, HH, 1, WU, HH); g.hwall.qx(HW, Z_HEND, Z_HBACK, 0, HH, -1, WU, HH);
    g.hwall.qz(Z_HEND, -HW, -.7, 0, HH, 1, WU, HH); g.hwall.qz(Z_HEND, .7, HW, 0, HH, 1, WU, HH); g.hwall.qz(Z_HEND, -.7, .7, 2.4, HH, 1, WU, HH);
    // the hole you climbed out of, with the ladder
    g.pit.qx(-.78, 1.3, 2.7, -4, 0, 1, 2, 2); g.pit.qx(.78, 1.3, 2.7, -4, 0, -1, 2, 2); g.pit.qz(1.3, -.78, .78, -4, 0, 1, 2, 2); g.pit.qz(2.7, -.78, .78, -4, 0, -1, 2, 2);
    g.dark.qy(-.78, .78, 1.3, 2.7, -4, true, 2);
    g.metal.box(-.82, -.02, 1.26, .82, .05, 1.34); g.metal.box(-.82, -.02, 2.66, .82, .05, 2.74); g.metal.box(-.86, -.02, 1.26, -.78, .05, 2.74); g.metal.box(.78, -.02, 1.26, .86, .05, 2.74);
    for (const x of [-.3, .3]) g.metal.box(x - .03, -4, 2.56, x + .03, 1.05, 2.64);
    g.metal.boxR(0, 1.05, 2.6, .33, .03, .03, 0, 0, 0);
    for (let y = -3.7; y < 1; y += .32) g.metal.box(-.3, y, 2.57, .3, y + .04, 2.63);
    // cavity behind the breakable wall
    g.pit.qy(-2.6, 2.6, Z_HBACK, Z_HBACK + 5, 0, true, 2); g.pit.qz(Z_HBACK + 5, -2.6, 2.6, 0, HH + .6, -1, 2, 2);
    g.pit.qx(-2.6, Z_HBACK, Z_HBACK + 5, 0, HH + .6, 1, 2, 2); g.pit.qx(2.6, Z_HBACK, Z_HBACK + 5, 0, HH + .6, -1, 2, 2); g.pit.qy(-2.6, 2.6, Z_HBACK, Z_HBACK + 5, HH + .6, false, 2);
    g.hwall.qz(Z_HBACK, -2.6, -HW, 0, HH + .6, -1, 2.4, HH); g.hwall.qz(Z_HBACK, HW, 2.6, 0, HH + .6, -1, 2.4, HH); g.hwall.qz(Z_HBACK, -HW, HW, HH, HH + .6, -1, 2.4, HH);
    // pipes, lamps
    for (const px of [1.35, 1.2]) g.metal.cylZ(Z_HBACK, Z_HEND, px, HH - .25, .05, 8);
    for (const [z, s] of HALL_LAMPS) { const x = s * (HW - .02); g.dark.box(x, 2.45, z - .18, x - s * .12, 2.7, z + .18); g.bulbs.box(x - s * .1, 2.5, z - .12, x - s * .14, 2.65, z + .12); }
    g.dark.box(-.2, HH - .12, -12.2, .2, HH, -11.8); g.beacon.box(-.12, HH - .3, -12.12, .12, HH - .12, -11.88);
    g.dark.box(-.2, HH - .12, -22.2, .2, HH, -21.8); g.beacon.box(-.12, HH - .3, -22.12, .12, HH - .12, -21.88);
    // hallway junk
    g.rust.boxR(-.75, .85, -10.3, .85, .85, .55, 0, .12, 0); g.metal.boxR(-1.1, .15, -9.4, .4, .15, .3, .2, .5, .3);
    g.wood.box(-.15, 0, -15, 1.6, .75, -13.6, .9, .9); g.wood.box(.1, .75, -14.85, 1.4, 1.5, -13.75, .9, .9);
    g.wood.box(-HW, 0, -18.4, HW, .5, -18.0, .9, .9); g.metal.box(-HW, .5, -18.35, HW, .62, -18.05);
    g.rust.boxR(-.7, .62, -21.85, .9, .62, .6, 0, -.08, 0); g.cloth.boxR(.9, .1, -20.6, .5, .08, .4, 0, .6, 0);
    g.wood.boxR(-.4, .05, -24.5, .9, .03, .1, 0, .7, 0); g.rust.boxR(.6, .03, -26.6, .7, .02, 1.1, 0, .25, 0);   // the broken door
    /* --- building shells (with lit windows) --- */
    for (const [x0, x1, z0, z1, top] of SKYLINE) {
      if (top <= STREET + .1) continue;
      g.facade.qx(x0, z0, z1, STREET, top, -1, FU, FU); g.facade.qx(x1, z0, z1, STREET, top, 1, FU, FU);
      g.facade.qz(z0, x0, x1, STREET, top, -1, FU, FU);
      if (Math.abs(z1 - Z_HEND) < .01 && x0 < 0 && x1 > 0 && top > 5) {   // the face you come out of
        g.facade.qz(z1, x0, -.7, STREET, top, 1, FU, FU); g.facade.qz(z1, .7, x1, STREET, top, 1, FU, FU); g.facade.qz(z1, -.7, .7, 2.4, top, 1, FU, FU); g.facade.qz(z1, -.7, .7, STREET, 0, 1, FU, FU);
      } else g.facade.qz(z1, x0, x1, STREET, top, 1, FU, FU);
      g.roof.qy(x0, x1, z0, z1, top, true, 4);
    }
    g.dark.qy(-60, 60, -170, 40, STREET, true, 8);
    // parapets around the roofs you run across
    const par = (x0, x1, z0, z1, y, h) => g.parapet.box(x0, y, z0, x1, y + h, z1, 2, 2);
    par(-5.3, -5, -52, Z_HEND, 0, .95); par(5, 5.3, -52, Z_HEND, 0, .95);
    par(-4.8, -4.5, GAP0, -52, RB_Y, .95); par(4.5, 4.8, GAP0, -52, RB_Y, .95);
    par(-4.5, 4.5, GAP0 + .05, GAP0 + .3, RB_Y, .28);
    par(-5.3, -5, ROOM_EDGE, GAP1, RB_Y, .95); par(5, 5.3, ROOM_EDGE, GAP1, RB_Y, .95); par(-5, ROOM.x0, ROOM_EDGE, ROOM_EDGE + .3, RB_Y, .95); par(ROOM.x1, 5, ROOM_EDGE, ROOM_EDGE + .3, RB_Y, .95);
    // rooftop clutter
    const box = (k, a, y0) => g[k].box(a[0], y0, a[2], a[1], a[4], a[3], 1, 1);
    box('metal', JUNK[4], 0); box('metal', JUNK[5], 0); box('rust', JUNK[6], 0); box('metal', JUNK[7], .2);
    for (let x = -4.5; x < 4.6; x += 1.5) g.metal.box(x - .05, 0, -44.2, x + .05, .2, -44);
    g.drum.cyl(3.25, -47.75, 1.2, 3.6, 1.15, 1.15, 18); g.drum.disk(3.25, 3.6, -47.75, 1.15, 18, true);
    for (const [x, z] of [[2.3, -46.8], [4.2, -46.8], [2.3, -48.7], [4.2, -48.7]]) g.metal.box(x - .06, 0, z - .06, x + .06, 1.2, z + .06);
    box('wood', JUNK[9], 0);
    g.metal.cyl(-2.5, -56.25, RB_Y, RB_Y + .8, .06, .06, 8); g.metal.boxR(-2.5, RB_Y + 1.6, -56.25, .95, .7, .08, -.5, .3, 0);
    box('wood', JUNK[11], RB_Y); box('rust', JUNK[12], RB_Y); box('wood', JUNK[13], RB_Y); box('metal', JUNK[14], RB_Y);
    for (const [x, y, z] of ROOF_LAMPS) { g.metal.cyl(x, z, y, y + 3.2, .06, .05, 8); g.metal.box(x, y + 3.1, z - .04, x - Math.sign(x) * .9, y + 3.18, z + .04); g.dark.box(x - Math.sign(x) * .7, y + 2.98, z - .18, x - Math.sign(x) * 1.05, y + 3.12, z + .18); g.sodium.box(x - Math.sign(x) * .72, y + 2.95, z - .13, x - Math.sign(x) * 1.03, y + 2.98, z + .13); }
    g.dark.box(-.35, 9, -26.6, .35, 9.4, -25.9); g.beacon.box(-.25, 9.4, -26.5, .25, 9.9, -26);
    /* --- the sheriff's room: a breakable front around the door, a window at the back --- */
    const R = ROOM, ry = RB_Y, rh = R.h;
    for (const [z, d] of [[R.z1, 1], [R.z1 - .02, -1]]) {
      g.room.qz(z, R.x0, -1.3, ry, ry + rh, d, 2.4, 2.4); g.room.qz(z, 1.3, R.x1, ry, ry + rh, d, 2.4, 2.4);
      g.rfront.qz(z, -1.3, -.6, ry, ry + rh, d, 2.4, 2.4); g.rfront.qz(z, .6, 1.3, ry, ry + rh, d, 2.4, 2.4); g.rfront.qz(z, -.6, .6, ry + 2.2, ry + rh, d, 2.4, 2.4);
    }
    for (const [x, d] of [[R.x0, -1], [R.x0 + .02, 1]]) g.room.qx(x, R.z0, R.z1, ry, ry + rh, d, 2.4, 2.4);
    for (const [x, d] of [[R.x1, 1], [R.x1 - .02, -1]]) g.room.qx(x, R.z0, R.z1, ry, ry + rh, d, 2.4, 2.4);
    for (const [z, d] of [[R.z0, -1], [R.z0 + .02, 1]]) {
      g.room.qz(z, R.x0, WIN.x0, ry, ry + rh, d, 2.4, 2.4); g.room.qz(z, WIN.x1, R.x1, ry, ry + rh, d, 2.4, 2.4);
      g.room.qz(z, WIN.x0, WIN.x1, ry, WIN.y0, d, 2.4, 2.4); g.room.qz(z, WIN.x0, WIN.x1, WIN.y1, ry + rh, d, 2.4, 2.4);
    }
    g.wood.box(WIN.x0 - .1, WIN.y0 - .07, R.z0 - .08, WIN.x1 + .1, WIN.y0, R.z0 + .16, .9, .9);   // sill
    g.wood.box(WIN.x0 - .1, WIN.y1, R.z0 - .06, WIN.x1 + .1, WIN.y1 + .08, R.z0 + .1, .9, .9);
    g.wood.box(WIN.x0 - .08, WIN.y0, R.z0 - .06, WIN.x0, WIN.y1, R.z0 + .1, .9, .9); g.wood.box(WIN.x1, WIN.y0, R.z0 - .06, WIN.x1 + .08, WIN.y1, R.z0 + .1, .9, .9);
    g.winbars.box(-.03, WIN.y0, R.z0 - .02, .03, WIN.y1, R.z0 + .04); g.winbars.box(WIN.x0, (WIN.y0 + WIN.y1) / 2 - .03, R.z0 - .02, WIN.x1, (WIN.y0 + WIN.y1) / 2 + .03, R.z0 + .04);
    g.roof.qy(R.x0, R.x1, R.z0, R.z1, ry + rh, true, 4);
    g.roomfloor.qy(R.x0, R.x1, R.z0, R.z1, ry + .01, true, 2); g.room.qy(R.x0, R.x1, R.z0, R.z1, ry + rh - .02, false, 2);
    g.rfmetal.box(-.7, ry, R.z1 - .1, -.6, ry + 2.25, R.z1 + .1); g.rfmetal.box(.6, ry, R.z1 - .1, .7, ry + 2.25, R.z1 + .1); g.rfmetal.box(-.7, ry + 2.2, R.z1 - .1, .7, ry + 2.3, R.z1 + .1);
    g.wood.box(-2.6, ry, -100.6, -1.2, ry + .8, -99.2, .9, .9); g.wood.box(1.4, ry, -100.7, 2.8, ry + .75, -99.7, .9, .9); g.cloth.box(-2.8, ry, -97.8, -1.6, ry + .45, -95.2);
    g.dark.box(-.1, ry + rh - .1, -97.6, .1, ry + rh, -97.4); g.warm.cyl(0, -97.5, ry + rh - .3, ry + rh - .1, .07, .07, 10);
    g.rfmetal.box(-.18, ry + 2.38, R.z1 + .02, .18, ry + 2.5, R.z1 + .2); g.rfwarm.box(-.12, ry + 2.34, R.z1 + .06, .12, ry + 2.38, R.z1 + .16);
    return g;
  }
  function buildRoomDoor() {   // local: hinge at x = 0, door spans +x
    const g = new Geo(); g.box(0, 0, -.03, 1.2, 2.2, .03); g.box(1.02, 1.0, -.07, 1.1, 1.08, .07); return g;
  }
  // the route Banban follows: [x, y, z, hop]
  const BANBAN_PATH = [[0, 0, 7.2], [0, 0, 4.6], [1.15, 0, 2.0], [.85, 0, -8.6], [.9, 0, -11.6], [0, 0, -12.6], [-.9, 0, -13.4], [-.9, 0, -15.6], [0, 0, -17.2], [0, 0, -19.2, 1], [.95, 0, -20.6], [.95, 0, -23], [0, 0, -25], [0, 0, -27.5],
    [-.3, 0, -31.8], [-.6, 0, -36.2], [1.2, 0, -38.2], [1.2, 0, -42.8], [.6, 0, -45.2, 1], [0, 0, -50.4], [0, RB_Y, -53.4, 1], [-.4, RB_Y, -58.5], [-.6, RB_Y, -62.5], [1.0, RB_Y, -65.2], [.4, RB_Y, -70.2], [0, RB_Y, -71.2]];
  const PATH_S = [0]; for (let i = 1; i < BANBAN_PATH.length; i++) { const a = BANBAN_PATH[i - 1], b = BANBAN_PATH[i]; PATH_S.push(PATH_S[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
  function pathAt(s) {
    s = clamp(s, 0, PATH_S[PATH_S.length - 1]);
    let i = 1; while (i < PATH_S.length - 1 && PATH_S[i] < s) i++;
    const a = BANBAN_PATH[i - 1], b = BANBAN_PATH[i], k = (s - PATH_S[i - 1]) / Math.max(1e-6, PATH_S[i] - PATH_S[i - 1]);
    const hop = b[3] ? Math.sin(Math.PI * k) * .9 : 0;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + hop, lerp(a[2], b[2], k), Math.atan2(b[0] - a[0], b[2] - a[2])];
  }
  // checkpoints: [player x, y, z, where Banban restarts (z on his path)]
  const C2_CHECKPOINTS = [[0, 0, -8.5, 4.0], [0, 0, -28.2, -17.2], [0, RB_Y, -54.2, -43.5]];
  function pathSOfZ(z) {   // the route only ever heads towards -z
    for (let i = 1; i < BANBAN_PATH.length; i++) { const a = BANBAN_PATH[i - 1], b = BANBAN_PATH[i]; if (z <= a[2] && z >= b[2]) return PATH_S[i - 1] + (PATH_S[i] - PATH_S[i - 1]) * (a[2] - z) / Math.max(1e-6, a[2] - b[2]); }
    return z > BANBAN_PATH[0][2] ? 0 : PATH_S[PATH_S.length - 1];
  }

  /* ================= chapter 2, part two: the hallway with the rope trap =================
     A hallway runs from the wake-up spot (z = 4.4) towards -z. Halfway down (z = -6) a door faces a door:
     the left one stays shut, the NaughtyOnes are behind the right one. At z = -18..-21.6 the hallway meets a
     cross corridor: left to the rope storeroom (shutter + button), right to Syringeon's room (shutter + button). */
  const H2 = { hw: 1.8, h: 3.4, zBack: 6, zJ0: -18, zJ1: -21.6, zM: -6, zD0: -6.6, zD1: -5.4, doorH: 2.3 };
  const ZC = -19.8;                                                     // centre line of the cross corridor
  const BTN_L = [-8, 1.25, -21.6], BTN_R = [7.5, 1.25, -21.6];           // buttons on the far wall
  const SHUT_L = { x: -12, z0: -21.0, z1: -18.6, h: 3.0 }, SHUT_R = { x: 12, z0: -21.1, z1: -18.5, h: 3.1 };
  const ROPE_ROOM = { x0: -17, x1: -12, z0: -23, z1: -16.6, h: 3.2 }, SYR_ROOM = { x0: 12, x1: 18, z0: -24, z1: -16, h: 3.6 };
  const N_ROOM = { x0: 1.8, x1: 5, z0: -8.4, z1: -3.6, h: 2.8 };
  const CRATE = [-15.5, -14.3, -20.4, -19.2, .78];
  const KNOT_L = [-1.72, .5, -6.4], KNOT_R = [1.72, .5, -6.4];          // where the rope gets tied (low hooks on the two doors)
  const HALL2_LAMPS = [[0, 3], [0, -1.5], [0, -6], [0, -10.5], [0, -15], [-8, ZC], [0, ZC], [8, ZC]];
  function buildSolids2() {
    const T = WALL_TOP;
    return [
      [-2.1, -1.8, -18, 6.3, T], [1.8, 2.1, -18, 6.3, T], [-1.8, 1.8, 6, 6.3, T],
      [-12, 12, -21.9, -21.6, T], [-12, -1.8, -18, -17.7, T], [1.8, 12, -18, -17.7, T],
      [-12.3, -12, -23, SHUT_L.z0, T], [-12.3, -12, SHUT_L.z1, -16.6, T],
      [12, 12.3, -24, SHUT_R.z0, T], [12, 12.3, SHUT_R.z1, -16, T],
      [-17.3, -17, -23, -16.6, T], [-17, -12, -23.3, -23, T], [-17, -12, -16.6, -16.3, T],
      [18, 18.3, -24, -16, T], [12, 18, -24.3, -24, T], [12, 18, -16, -15.7, T],
      CRATE
    ];
  }
  // where Syringeon walks: four boxes that touch at the junction / the shutter openings
  function region2(x, z) {
    if (x < -12) return 'L'; if (x > 12) return 'R';
    if (z < -18 + .01) return 'J';
    return 'H';
  }
  function shutterTexture() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5b5e60'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = '#3c3f41'; g.fillRect(0, y, w, 3); g.fillStyle = '#7a7d7f'; g.fillRect(0, y + 3, w, 2); }
      g.save(); g.beginPath(); g.rect(0, h - 40, w, 40); g.clip();
      for (let x = -40; x < w + 40; x += 40) { g.fillStyle = '#e0b31c'; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h); g.lineTo(x + 60, h - 40); g.lineTo(x + 40, h - 40); g.fill(); }
      g.restore(); g.fillStyle = '#1b1b1b'; g.fillRect(0, h - 44, w, 4);
      noiseLayer(g, w, h, 6, 4, (d, i, n) => { const k = .72 + n * .45; d[i] *= k; d[i + 1] *= k * .97; d[i + 2] *= k * .93; });
    });
  }
  function buildArea2() {
    const g = {};
    for (const k of ['floor', 'wall', 'ceil', 'trim', 'metal', 'lamp', 'tube', 'roomwall', 'syrwall', 'nroom', 'crate', 'red', 'signL', 'signR']) g[k] = new Geo();
    const { hw, h } = H2, WU = 2.4, WV = 3.2;
    /* floors + ceilings */
    g.floor.qy(-hw, hw, -18, H2.zBack, 0, true, 2); g.floor.qy(-12, 12, H2.zJ1, -18, 0, true, 2);
    g.ceil.qy(-hw, hw, -18, H2.zBack, h, false, 2.6); g.ceil.qy(-12, 12, H2.zJ1, -18, h, false, 2.6);
    g.floor.qy(ROPE_ROOM.x0, ROPE_ROOM.x1, ROPE_ROOM.z0, ROPE_ROOM.z1, 0, true, 2); g.ceil.qy(ROPE_ROOM.x0, ROPE_ROOM.x1, ROPE_ROOM.z0, ROPE_ROOM.z1, ROPE_ROOM.h, false, 2.6);
    g.floor.qy(SYR_ROOM.x0, SYR_ROOM.x1, SYR_ROOM.z0, SYR_ROOM.z1, 0, true, 2); g.ceil.qy(SYR_ROOM.x0, SYR_ROOM.x1, SYR_ROOM.z0, SYR_ROOM.z1, SYR_ROOM.h, false, 2.6);
    g.nroom.qy(N_ROOM.x0, N_ROOM.x1, N_ROOM.z0, N_ROOM.z1, .005, true, 2); g.nroom.qy(N_ROOM.x0, N_ROOM.x1, N_ROOM.z0, N_ROOM.z1, N_ROOM.h, false, 2);
    /* hallway walls with the two middle door openings */
    for (const [x, d] of [[-hw, 1], [hw, -1]]) {
      g.wall.qx(x, -18, H2.zD0, 0, h, d, WU, WV); g.wall.qx(x, H2.zD1, H2.zBack, 0, h, d, WU, WV); g.wall.qx(x, H2.zD0, H2.zD1, H2.doorH, h, d, WU, WV);
      g.metal.box(x - .06, 0, H2.zD0 - .08, x + .06, H2.doorH + .08, H2.zD0); g.metal.box(x - .06, 0, H2.zD1, x + .06, H2.doorH + .08, H2.zD1 + .08);
      g.metal.box(x - .06, H2.doorH, H2.zD0, x + .06, H2.doorH + .08, H2.zD1);
    }
    g.wall.qz(H2.zBack, -hw, hw, 0, h, -1, WU, WV);
    /* cross corridor */
    g.wall.qz(H2.zJ1, -12, 12, 0, h, 1, WU, WV);
    g.wall.qz(-18, -12, -hw, 0, h, -1, WU, WV); g.wall.qz(-18, hw, 12, 0, h, -1, WU, WV);
    g.wall.qx(-12, H2.zJ1, SHUT_L.z0, 0, h, 1, WU, WV); g.wall.qx(-12, SHUT_L.z1, -18, 0, h, 1, WU, WV); g.wall.qx(-12, SHUT_L.z0, SHUT_L.z1, SHUT_L.h, h, 1, WU, WV);
    g.wall.qx(12, H2.zJ1, SHUT_R.z0, 0, h, -1, WU, WV); g.wall.qx(12, SHUT_R.z1, -18, 0, h, -1, WU, WV); g.wall.qx(12, SHUT_R.z0, SHUT_R.z1, SHUT_R.h, h, -1, WU, WV);
    // skirting + a pipe along the corridors
    for (const [x, d] of [[-hw + .01, 1], [hw - .01, -1]]) { g.trim.qx(x, -18, H2.zD0, 0, .12, d, 1, 1); g.trim.qx(x, H2.zD1, H2.zBack, 0, .12, d, 1, 1); }
    g.trim.qz(H2.zJ1 + .01, -12, 12, 0, .12, 1, 1, 1);
    g.metal.cylZ(H2.zBack, -18, -1.55, h - .3, .06, 8); g.metal.cylX(-12, 12, h - .3, H2.zJ1 + .25, .06, 8);
    /* shutter frames + signs */
    for (const [S, s] of [[SHUT_L, 1], [SHUT_R, -1]]) {
      const x = S.x + s * .04;
      g.metal.box(x - .07, 0, S.z0 - .12, x + .07, S.h + .1, S.z0); g.metal.box(x - .07, 0, S.z1, x + .07, S.h + .1, S.z1 + .12);
      g.metal.box(x - .09, S.h, S.z0 - .12, x + .09, S.h + .22, S.z1 + .12);
    }
    const sign = (gg, x0, x1, y0, y1) => gg.quad([x0, y0, H2.zJ1 + .02], [x1, y0, H2.zJ1 + .02], [x1, y1, H2.zJ1 + .02], [x0, y1, H2.zJ1 + .02], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    sign(g.signL, -11.7, -10.2, 2.2, 2.575); sign(g.signR, 10.2, 11.7, 2.2, 2.575);
    /* rope storeroom */
    { const R = ROPE_ROOM;
      g.roomwall.qx(R.x0, R.z0, R.z1, 0, R.h, 1, WU, WV); g.roomwall.qz(R.z0, R.x0, R.x1, 0, R.h, 1, WU, WV); g.roomwall.qz(R.z1, R.x0, R.x1, 0, R.h, -1, WU, WV);
      g.roomwall.qx(R.x1, R.z0, SHUT_L.z0, 0, R.h, -1, WU, WV); g.roomwall.qx(R.x1, SHUT_L.z1, R.z1, 0, R.h, -1, WU, WV); g.roomwall.qx(R.x1, SHUT_L.z0, SHUT_L.z1, SHUT_L.h, R.h, -1, WU, WV);
      g.crate.box(CRATE[0], 0, CRATE[2], CRATE[1], CRATE[4], CRATE[3], .9, .9);
      g.crate.box(-16.8, 0, -22.8, -15.6, 1.1, -21.6, .9, .9); g.crate.box(-16.7, 1.1, -22.6, -15.9, 1.7, -21.8, .9, .9);
      g.metal.box(-16.95, 0, -18.4, -16.6, 2.2, -16.8); for (const y of [.5, 1.1, 1.7]) g.metal.box(-16.95, y, -18.4, -16.4, y + .04, -16.8);
      g.lamp.box(-14.8, R.h - .08, -20.1, -14.2, R.h, -19.5); }
    /* Syringeon's room */
    { const R = SYR_ROOM;
      g.syrwall.qx(R.x1, R.z0, R.z1, 0, R.h, -1, WU, WV); g.syrwall.qz(R.z0, R.x0, R.x1, 0, R.h, 1, WU, WV); g.syrwall.qz(R.z1, R.x0, R.x1, 0, R.h, -1, WU, WV);
      g.syrwall.qx(R.x0, R.z0, SHUT_R.z0, 0, R.h, 1, WU, WV); g.syrwall.qx(R.x0, SHUT_R.z1, R.z1, 0, R.h, 1, WU, WV); g.syrwall.qx(R.x0, SHUT_R.z0, SHUT_R.z1, SHUT_R.h, R.h, 1, WU, WV);
      for (const z of [-23.4, -16.6]) for (const x of [14, 17.4]) g.metal.box(x - .08, 0, z - .08, x + .08, R.h, z + .08);   // support posts
      g.metal.box(17.2, 0, -23.6, 17.95, 2.4, -22.4); g.trim.box(17.25, .6, -23.55, 17.9, .64, -22.45); g.trim.box(17.25, 1.4, -23.55, 17.9, 1.44, -22.45);   // a cabinet
      for (let k = 0; k < 6; k++) g.trim.boxR(13 + k * .8, .03, -23.3 + (k % 2) * .4, .3, .03, .05, 0, k * .9, 0);       // scraps on the floor
      g.lamp.box(14.7, R.h - .08, -20.3, 15.3, R.h, -19.7); g.red.box(14.85, R.h - .14, -20.15, 15.15, R.h - .08, -19.85); }
    /* the NaughtyOnes' closet behind the right middle door */
    { const R = N_ROOM;
      g.nroom.qx(R.x1, R.z0, R.z1, 0, R.h, -1, 2, 2); g.nroom.qz(R.z0, R.x0, R.x1, 0, R.h, 1, 2, 2); g.nroom.qz(R.z1, R.x0, R.x1, 0, R.h, -1, 2, 2);
      g.nroom.qx(R.x0 + .02, R.z0, H2.zD0, 0, R.h, 1, 2, 2); g.nroom.qx(R.x0 + .02, H2.zD1, R.z1, 0, R.h, 1, 2, 2); g.nroom.qx(R.x0 + .02, H2.zD0, H2.zD1, H2.doorH, R.h, 1, 2, 2); }
    /* lamps */
    for (const [x, z] of HALL2_LAMPS) {
      const along = Math.abs(z - ZC) < .01;
      if (along) { g.lamp.box(x - .65, h - .08, z - .16, x + .65, h, z + .16); g.tube.box(x - .58, h - .12, z - .07, x + .58, h - .08, z + .07); }
      else { g.lamp.box(x - .16, h - .08, z - .65, x + .16, h, z + .65); g.tube.box(x - .07, h - .12, z - .58, x + .07, h - .08, z + .58); }
    }
    // the button panels
    for (const B of [BTN_L, BTN_R]) { g.metal.box(B[0] - .24, B[1] - .32, B[2], B[0] + .24, B[1] + .32, B[2] + .06); g.trim.box(B[0] - .2, B[1] - .28, B[2] + .06, B[0] + .2, B[1] + .28, B[2] + .07); }
    // hooks on the two middle doors are part of the door meshes; a little junk to make the hall feel used
    g.crate.box(1.0, 0, 2.4, 1.7, .6, 3.2, .9, .9); g.trim.boxR(-1.2, .06, -12.5, .5, .06, .3, 0, .4, 0); g.crate.box(-11.6, 0, -21.5, -10.8, .7, -20.8, .9, .9);
    return g;
  }
  function buildMidDoor() {   // local: hinge at x = 0, the door spans +x, a low hook near the free edge
    const g = new Geo(); g.box(0, 0, -.03, 1.2, H2.doorH, .03, .9, .9); g.box(1.04, .95, -.07, 1.12, 1.03, .07); g.box(.95, .46, -.09, 1.05, .54, .09);
    return g;
  }

  /* ================= chapter 2 main ================= */
  function banbanPose(run, ph, roar, t) {
    const s = Math.sin(ph), c = Math.cos(ph), d = {};
    const hip = 42 * D * run, knee = 78 * D * run, lF = s * hip, rF = -s * hip;
    d['Bone.013'] = Q.aa(0, 0, 1, -lF); d['Bone.016'] = Q.aa(0, 0, 1, rF);                    // thighs: left fwd = -Z, right fwd = +Z
    const lK = 8 * D + Math.max(0, c) ** 1.3 * knee, rK = 8 * D + Math.max(0, -c) ** 1.3 * knee;
    d['Bone.014'] = Q.aa(0, 0, 1, lK); d['Bone.017'] = Q.aa(0, 0, 1, -rK);                     // knees
    const arm = 48 * D * run, up = roar * 75 * D, out = roar * 40 * D;
    d['Bone.005'] = Q.mul(Q.aa(1, 0, 0, -s * arm + up), Q.aa(0, 0, 1, out));                  // arms swing / raise (fwd = +X)
    d['Bone.007'] = Q.mul(Q.aa(1, 0, 0, s * arm + up), Q.aa(0, 0, 1, -out));
    d['Bone.006'] = Q.aa(1, 0, 0, (25 + 25 * run + 20 * roar) * D); d['Bone.008'] = Q.aa(1, 0, 0, (25 + 25 * run + 20 * roar) * D);
    d['Bone'] = Q.aa(1, 0, 0, (16 * run - 14 * roar) * D + Math.sin(ph * 2) * 3 * D * run);
    d['Bone.001'] = Q.aa(1, 0, 0, (8 * run - 8 * roar) * D);
    d['Bone.002'] = Q.aa(1, 0, 0, (-8 * run - 22 * roar) * D + Math.sin(t * 23) * roar * 3 * D);
    ['Bone.019', 'Bone.020', 'Bone.021', 'Bone.022', 'Bone.023', 'Bone.024'].forEach((n, i) => { d[n] = Q.euler(Math.sin(t * 9 + i * .8) * (.12 + roar * .2), 0, Math.sin(t * 6 + i) * .15); });
    for (const n of ['Bone.030', 'Bone.031', 'Bone.032', 'Bone.027', 'Bone.028', 'Bone.029']) d[n] = Q.aa(1, 0, 0, (roar * -30 + Math.sin(t * 5) * 6) * D);
    return d;
  }

  async function startC2(opts) {
    const canvas = opts.canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 not available');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const container = opts.container || canvas.parentElement;
    const progW = compile(gl, VS_WORLD, FS), progS = compile(gl, VS_SKIN, FS);

    /* ---- world ---- */
    const W = buildWorldC2(); const M = {}; for (const k in W) M[k] = meshFromGeo(gl, W[k]);
    const doorM = meshFromGeo(gl, buildRoomDoor());
    const cubeG = new Geo(); cubeG.box(-.5, -.5, -.5, .5, .5, .5, .8, .8); const cubeM = meshFromGeo(gl, cubeG);
    const spriteG = new Geo(); spriteG.quad([-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
    const sprite = meshFromGeo(gl, spriteG);
    const quadG = new Geo(); quadG.quad([-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [0, 1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
    const blob = meshFromGeo(gl, quadG);
    const texFloor = texFromCanvas(gl, floorTexture(), aniso), texWall = texFromCanvas(gl, wallTexture(), aniso), texWin = texFromCanvas(gl, windowTexture(), aniso);
    const solids = buildSolidsC2();
    // part two
    const W2 = buildArea2(); const M2 = {}; for (const k in W2) M2[k] = meshFromGeo(gl, W2[k]);
    const midDoorM = meshFromGeo(gl, buildMidDoor());
    const shutGeo = (w, h) => {
      const g = new Geo(), u = w / 1.2;
      g.quad([-.04, 0, w / 2], [-.04, 0, -w / 2], [-.04, h, -w / 2], [-.04, h, w / 2], [-1, 0, 0], [0, 0], [u, 0], [u, 1], [0, 1]);
      g.quad([.04, 0, -w / 2], [.04, 0, w / 2], [.04, h, w / 2], [.04, h, -w / 2], [1, 0, 0], [0, 0], [u, 0], [u, 1], [0, 1]);
      return meshFromGeo(gl, g);
    };
    const shutLM = shutGeo(SHUT_L.z1 - SHUT_L.z0, SHUT_L.h), shutRM = shutGeo(SHUT_R.z1 - SHUT_R.z0, SHUT_R.h);
    const cylG = new Geo(); cylG.cylZ(0, 1, 0, 0, 1, 10); const cylM = meshFromGeo(gl, cylG);
    const texShut = texFromCanvas(gl, shutterTexture(), aniso), texSignL = texFromCanvas(gl, signTexture('STORAGE', '#1d3a2a', '#e8e2c8'), aniso), texSignR = texFromCanvas(gl, signTexture('DANGER', '#6e0e0a', '#f3e6c8'), aniso);
    const solids2 = buildSolids2();

    /* ---- characters ---- */
    const banban = makeRig(gl, opts.banban);
    let toad = null;
    const ensureToad = () => { if (!toad && opts.getToad) { const d = opts.getToad(); if (d) { try { toad = makeRig(gl, d); toad.setPose(null); toad.restFeet = Math.min(toad.jointPos('LeftToe_End')[1], toad.jointPos('LeftFoot')[1]); } catch (e) { console.error(e); } } } return toad; };
    const B_SC = 3.0 / (banban.meta.bbox[1][1] - banban.meta.bbox[0][1]);
    banban.setPose(null);
    const B_FEET = ['Bone.015', 'Bone.018', 'Bone.026', 'Bone.025'], B_REST = B_FEET.map(n => banban.jointPos(n)[1]), B_FOOT = -banban.meta.bbox[0][1];
    const T_SC = 2.6 / 6.6;
    // Syringeon, the NaughtyOnes and the rope arrive in the background while you play part one
    let syr = null, nrig = null, ropeM = null, S_SC = 1, S_OFF = [0, 0, 0], S_FEET = 0, N_SC = 1, N_OFF = [0, 0, 0];
    function ensureArea2Models() {
      try {
        if (!syr && opts.getSyr) { const d = opts.getSyr(); if (d) { syr = makeRig(gl, d); const b = syr.meta.bbox; S_SC = 2.7 / (b[1][1] - b[0][1]); S_OFF = [-(b[0][0] + b[1][0]) / 2, -b[0][1], -(b[0][2] + b[1][2]) / 2]; syr.setPose(null); S_FEET = Math.min(syr.jointPos('FootL')[1], syr.jointPos('FootR')[1]); } }
        if (!nrig && opts.getNaughty) { const d = opts.getNaughty(); if (d) { nrig = makeRig(gl, d); const b = nrig.meta.bbox; N_SC = .85 / (b[1][1] - b[0][1]); N_OFF = [-(b[0][0] + b[1][0]) / 2, -b[0][1], -(b[0][2] + b[1][2]) / 2]; } }
        if (!ropeM && opts.getRope) { const d = opts.getRope(); if (d) { ropeM = makeStatic(gl, d); const b = d.meta.bbox; ropeM.c = [0, 1, 2].map(i => (b[0][i] + b[1][i]) / 2); ropeM.color = d.meta.color; } }
      } catch (e) { console.error(e); }
      return !!(syr && nrig && ropeM);
    }

    /* ---- hud, audio ---- */
    const hud = makeHud(container, { deadTitle: 'YOU GOT<br>CAUGHT', endTitle: 'CHAPTER 2<br>COMPLETE' });
    const sfx = makeAudio(opts.getAC, opts.sfxOn || (() => true));
    const A = opts.audio || {};
    const musicVol = opts.musicVol || (() => 1), musicOn = opts.musicOn || (() => true);
    const envHand = opts.envHand || '';
    const envAt = (el, env) => { if (!el || el.paused) return 0; const i = Math.floor(el.currentTime / .05); return i >= 0 && i < env.length ? (+env[i]) / 9 : 0; };

    /* ---- state ---- */
    const st = {
      phase: 'wake', t: 0, camYaw: 0, camPitch: 0, eye: [0, 1.62, .4], wakeT: 0, dragYaw: 0, dragPitch: 0,
      p: { x: 0, y: 0, z: .4, vy: 0, yaw: 0, pitch: 0, bob: 0, lastStep: 0, moving: 0, grounded: true },
      freezeT: -1, broken: false, breakT: -1, alarmT: -1, cp: 0, caughtT: -1,
      handSaid: false, leapT: -1, leapFrom: null, hangT: -1, pullT: -1, closeT: -1, doorAng: Math.PI / 2, doneT: -1,
      toastUntil: 0, toastKey: '', timers: []
    };
    const bb = { state: 'hidden', s: 0, x: 0, y: 0, z: 7.2, yaw: Math.PI, ph: 0, run: 0, roar: 0, stepT: 0, growlT: 0 };
    const td = { state: 'wait', x: 0, y: RB_Y, z: GAP1 - 1.0, yaw: 0, ph: 0, run: 0, wp: 0 };
    const TD_ROUTE = [[1.3, -83.5], [0, -92.6], [0, -95.4], [1.7, -96.8]];
    const chunks = CHUNKS.map(c => ({ p: c.slice(), v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0], rest: true }));
    const later = (dt, fn) => st.timers.push({ at: st.t + dt, fn });
    st.area = 1; st.frontBroken = false; st.frontT = -1; st.jumpT = -1; st.glassBroken = false; st.shk = { t0: -9, amp: 0, dur: 1 }; st.lastPZ = 0;
    const frontBits = FRONT_CHUNKS.map(c => ({ p: [c[0], c[1], c[2]], s: [c[3], c[4], .22], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0], rest: false }));
    const doorBody = { p: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0], rest: false };
    const shards = [];
    const a2 = { btnL: -1, btnR: -1, shutL: 0, shutR: 0, shutLT: -1, shutRT: -1, rope: 'crate', tie1: null, trapT: -1, scratchT: 0, doorShakeT: -9, hopT: -9, savedT: -1, quakeT: -9, said: {}, act: null, fires: [], buzzT: -9 };
    const rdoor = { state: 'shut', p: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0] };
    const sy = { state: 'hidden', x: 15.6, z: ZC, yaw: -Math.PI / 2, animT: 0, st0: 0, lastZ: ZC, stepT: 0, growlT: 0, roarT: 0, walking: false, M: M4.ident() };
    const NAUGHTY_ATTACH = [['Head', 0, .3, -.25], ['ArmSyringe2', 1.6, .28, -.4], ['LegR2', -1.4, .3, -.35]];
    const nos = NAUGHTY_ATTACH.map((a, i) => ({ state: 'hidden', joint: a[0], ang: a[1], off: a[2], dy: a[3], x: 3.4, y: 0, z: -6, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2, rx: 0, hits: 0, t0: 0, lt: 0, from: null, animT: i * 1.7, biteT: 0, shakeT: -9, spin: 0 }));


    /* ---- input ---- */
    const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
    let lookId = null, lx = 0, ly = 0;
    const keys = { f: 0, b: 0, l: 0, r: 0 };
    const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    const CONTROL_PHASES = ['explore', 'chase', 'follow', 'escape', 'explore2', 'chase2', 'fight'];
    const controlling = () => CONTROL_PHASES.includes(st.phase);
    function resetJoy() { hud.joy.style.left = '96px'; hud.joy.style.top = Math.max(70, hud.zone.clientHeight - 104) + 'px'; hud.thumb.style.transform = ''; }
    resetJoy();
    const onZoneDown = e => {
      if (joy.id !== null) return;
      joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
      const r = hud.zone.getBoundingClientRect(); hud.joy.style.left = (e.clientX - r.left) + 'px'; hud.joy.style.top = (e.clientY - r.top) + 'px';
      try { hud.zone.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    };
    const onCanvasDown = e => { if (lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} };
    function look(dx, dy) {
      const k = .0055;
      if (controlling()) { st.p.yaw += dx * k; st.p.pitch = clamp(st.p.pitch - dy * k, -1.2, 1.2); }
      else if (st.phase === 'wake') { st.dragYaw += dx * k; st.dragPitch = clamp(st.dragPitch - dy * k, -.9, .9); }
    }
    const onMove = e => {
      if (e.pointerId === joy.id) {
        let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const R = 50, d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        joy.x = dx / R; joy.y = dy / R; hud.thumb.style.transform = `translate(${dx}px,${dy}px)`;
      } else if (e.pointerId === lookId) { const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; look(dx, dy); }
    };
    const onUp = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; resetJoy(); } if (e.pointerId === lookId) lookId = null; };
    const onKey = e => {
      const k = KEYMAP[e.code];
      if (k) { keys[k] = e.type === 'keydown' ? 1 : 0; if (controlling()) e.preventDefault(); }
      if (e.type === 'keydown' && !e.repeat && e.code === 'Space') { e.preventDefault(); doJump(); }
      if (e.type === 'keydown' && !e.repeat && (e.code === 'KeyE' || e.code === 'Enter')) { e.preventDefault(); onAct(); }
    };
    const onBlur = () => { keys.f = keys.b = keys.l = keys.r = 0; };
    hud.zone.addEventListener('pointerdown', onZoneDown); canvas.addEventListener('pointerdown', onCanvasDown);
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur);
    onPress(hud.jump, doJump); onPress(hud.act, () => onAct());
    hud.endBtn.addEventListener('click', () => { opts.onExit && opts.onExit(); });
    hud.respawn.addEventListener('click', () => respawn());

    /* ---- helpers ---- */
    function setObjective(text, alarm) { hud.obj.textContent = text || ''; hud.obj.classList.toggle('show', !!text); hud.obj.classList.toggle('alarm', !!alarm); }
    function toast(text, key, secs = 3) {
      if (key && st.toastKey === key && st.t < st.toastUntil + 4) return;
      st.toastKey = key || text; st.toastUntil = st.t + secs; hud.toast.textContent = text; hud.toast.classList.add('show');
    }
    function setControls(on, jump) {
      hud.zone.classList.toggle('on', on); hud.jump.classList.toggle('show', !!(on && jump));
      if (!on) { joy.id = null; joy.x = joy.y = 0; resetJoy(); } else resetJoy();
    }
    function playMusic(el) { if (!el) return; try { el.currentTime = 0; el.loop = true; el.muted = !musicOn(); el.volume = musicVol(); } catch (e) {} const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    function playVoice(el) {
      if (!el) return;
      const m = A.croak, wasPlaying = m && !m.paused;
      if (m && opts.canDuck && opts.canDuck()) try { m.volume = musicVol() * .3; } catch (e) {}
      el.onended = () => {
        if (!m) return;
        try { m.volume = musicVol(); } catch (e) {}
        if (wasPlaying && m.paused && st.phase !== 'done') { const p = m.play(); if (p && p.catch) p.catch(() => {}); }   // phones pause the music for the voice
      };
      try { el.currentTime = 0; } catch (e) {}
      const p = el.play(); if (p && p.catch) p.catch(() => {});
    }
    const blockers = () => {
      if (st.area === 2) {
        const list = solids2.slice();
        if (a2.shutL < .7) list.push([-12.3, -12, SHUT_L.z0, SHUT_L.z1, WALL_TOP]);
        if (a2.shutR < .7) list.push([12, 12.3, SHUT_R.z0, SHUT_R.z1, WALL_TOP]);
        return list;
      }
      const list = st.broken ? solids.filter((_, i) => i !== BACKWALL_I) : solids.slice();
      if (st.leapT < 0) list.push(EDGE_BAR);
      if (!st.frontBroken) { list.push(FRONT_BREAK[0], FRONT_BREAK[1]); if (st.doorAng < .3) list.push([-.6, .6, ROOM.z1 - .1, ROOM.z1 + .1, WALL_TOP]); }
      return list;
    };
    const ACT_LABEL = { window: 'JUMP<br>OUT', pressL: 'PRESS', pressR: 'PRESS', grab: 'GRAB', tieL: 'TIE<br>ROPE', tieR: 'TIE<br>ROPE', pull: 'PULL!' };
    function setAct(kind) {
      if (kind !== a2.act) { a2.act = kind; hud.act.classList.toggle('show', !!kind); if (kind) hud.label.innerHTML = ACT_LABEL[kind]; }
      if (kind === 'pull') { const n = pullTarget(), h = n ? n.hits : 0; hud.pips.innerHTML = '<i class="' + (h > 0 ? 'on' : '') + '"></i><i></i>'; }
      else if (kind) hud.pips.innerHTML = '';
    }
    function shake(amp, dur) { st.shk = { t0: st.t, amp, dur }; }
    function speak(text) {
      try {
        const ss = window.speechSynthesis; if (!ss || !window.SpeechSynthesisUtterance) return;
        const u = new SpeechSynthesisUtterance(text); u.pitch = .45; u.rate = .88; u.volume = 1;
        const m = A.seneng, was = m && !m.paused;
        if (m && opts.canDuck && opts.canDuck()) try { m.volume = musicVol() * .35; } catch (e) {}
        u.onend = () => { if (!m) return; try { m.volume = musicVol(); } catch (e) {} if (was && m.paused && alive) { const pr = m.play(); if (pr && pr.catch) pr.catch(() => {}); } };
        ss.cancel(); ss.speak(u);
      } catch (e) {}
    }
    const STEP = .42;
    function groundAt(x, z, feet) {
      if (st.area === 2) return 0;
      let g = -Infinity;
      for (const f of FLOORS) if (x >= f[0] && x <= f[1] && z >= f[2] && z <= f[3] && f[4] <= feet + STEP) g = Math.max(g, f[4]);
      if (x >= ROOM.x0 && x <= ROOM.x1 && z >= ROOM.z0 && z <= ROOM.z1) g = Math.max(g, RB_Y);
      for (const b of JUNK) if (x >= b[0] - .15 && x <= b[1] + .15 && z >= b[2] - .15 && z <= b[3] + .15 && b[4] <= feet + STEP) g = Math.max(g, b[4]);
      return g;
    }
    function collide(p) {
      const r = .3, list = blockers();
      for (let it = 0; it < 2; it++) for (const b of list) {
        if (b[4] <= p.y + STEP) continue;
        const cx = clamp(p.x, b[0], b[1]), cz = clamp(p.z, b[2], b[3]);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
        else { const pen = [[p.x - b[0] + r, -1, 0], [b[1] - p.x + r, 1, 0], [p.z - b[2] + r, 0, -1], [b[3] - p.z + r, 0, 1]].sort((u, w) => u[0] - w[0])[0]; p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0]; }
      }
    }
    function nearEdge() { const p = st.p; return st.phase === 'chase' && p.y > RB_Y - .1 && p.z < GAP0 + 2.6 && Math.abs(p.x) < 4.2; }
    function doJump() {
      if (!controlling()) return;
      if (a2.act === 'window') { jumpOut(); return; }
      if (nearEdge()) { startLeap(); return; }
      if (st.p.grounded) { st.p.vy = 6.6; st.p.grounded = false; sfx.jump(); }
    }

    /* ---- story beats ---- */
    function beginExplore() {
      st.phase = 'explore'; st.p.yaw = st.camYaw; st.p.pitch = st.camPitch; st.dragYaw = st.dragPitch = 0;
      setControls(true, false); setObjective('Find a way out'); hud.lids.classList.remove('on');
      if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) { hud.keys.textContent = 'WASD / arrows to move \u00b7 drag to look \u00b7 space to jump'; hud.keys.classList.add('show'); setTimeout(() => hud.keys.classList.remove('show'), 8000); }
    }
    function startFreeze() {
      st.phase = 'freeze'; st.freezeT = st.t; setControls(false); setObjective('');
      toast("You can't move\u2026!", 'freeze', 2.2); sfx.rumble();
      st.turnFrom = st.p.yaw; st.pitchFrom = st.p.pitch;
      later(1.9, breakWall);
      later(2.3, () => { bb.state = 'roarIn'; bb.roarT = st.t; sfx.roar(1.2); });
      later(2.75, () => { st.alarmT = st.t; hud.red.classList.add('on'); playMusic(A.croak); });
      later(3.2, () => { bb.state = 'run'; });
      later(3.9, () => { st.phase = 'chase'; st.p.yaw = 0; st.p.pitch = 0; setControls(true, true); setObjective('RUN!', true); });
    }
    function breakWall() {
      st.broken = true; st.breakT = st.t; sfx.crash(); bb.state = 'burst'; bb.s = 0;
      spawnWallChunks();
    }
    function spawnWallChunks() {
      for (const c of chunks) { c.rest = false; c.v = [(Math.random() - .5) * 3.5, 1.5 + Math.random() * 3.5, -(5 + Math.random() * 6)]; c.w = [(Math.random() - .5) * 9, (Math.random() - .5) * 9, (Math.random() - .5) * 9]; }
    }
    function startLeap() {
      st.phase = 'leap'; st.leapT = st.t; st.leapFrom = { x: st.p.x, y: st.p.y, z: st.p.z, yaw: st.p.yaw };
      setControls(false); setObjective(''); hud.jump.classList.remove('big'); sfx.jump();
      td.state = 'catch'; td.x = clamp(st.p.x, -3.5, 3.5); td.z = GAP1 - .62; td.yaw = 0;
    }
    function caughtByBanban() {
      st.phase = 'caught'; st.caughtT = st.t; setControls(false); setObjective(''); bb.state = 'grab'; sfx.scream(); sfx.roar(1);
      later(1.6, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(2.1, () => { st.phase = 'dead'; hud.dead.classList.add('show'); });
    }
    function respawn() {
      if (st.phase !== 'dead') return;
      if (st.cp === 'room') {
        Object.assign(st.p, { x: 0, y: RB_Y, z: -97.6, vy: 0, yaw: 0, pitch: 0, grounded: true });
        Object.assign(bb, { state: 'door', x: 0, y: RB_Y, z: ROOM.z1 + .7, yaw: Math.PI, run: 0, lean: 0 });
        hud.dead.classList.remove('show'); st.phase = 'escape'; setControls(true, false); setObjective('Jump out of the window!', true);
        later(2.0, () => { if (bb.state === 'door') bb.state = 'charge'; });
        later(.15, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
        return;
      }
      if (st.cp === 'syr') {
        Object.assign(st.p, { x: 6.4, y: 0, z: ZC, vy: 0, yaw: -Math.PI / 2, pitch: 0, grounded: true });
        Object.assign(sy, { state: 'emerge', x: 15.2, z: ZC, yaw: -Math.PI / 2, animT: 0, walking: false, lastZ: ZC });
        hud.dead.classList.remove('show'); st.phase = 'chase2'; setControls(true, false); setObjective('RUN! Lead it to the rope!', true); st.lastPZ = st.p.z;
        later(.15, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
        return;
      }
      const cp = C2_CHECKPOINTS[st.cp];
      Object.assign(st.p, { x: cp[0], y: cp[1], z: cp[2], vy: 0, yaw: 0, pitch: 0, grounded: true });
      bb.state = 'run'; bb.s = pathSOfZ(cp[3]); const q = pathAt(bb.s); bb.x = q[0]; bb.y = q[1]; bb.z = q[2];
      hud.dead.classList.remove('show'); st.phase = 'chase'; setControls(true, true); setObjective('RUN!', true);
      later(.15, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
    }
    function startClose() {
      st.phase = 'closing'; st.closeT = st.t; setControls(false); setObjective(''); td.state = 'close';
      later(.75, () => sfx.land(1.6));
      later(1.15, () => sfx.lock());
      later(1.7, () => { td.state = 'inside'; });
      later(2.6, () => knock(.7)); later(3.4, () => knock(1)); later(4.1, () => knock(1.3));
      later(4.8, breakFront);
    }
    function knock(v) { st.knockT = st.t; sfx.thud(); sfx.land(v); shake(.025 * v, .5); if (v > 1) sfx.growl(1); }
    function breakFront() {
      st.frontBroken = true; st.frontT = st.t; sfx.crash(); sfx.roar(1.3); shake(.06, 1.1);
      spawnFrontBits();
      Object.assign(bb, { state: 'door', x: 0, y: RB_Y, z: ROOM.z1 + .7, yaw: Math.PI, run: 0, lean: 0 });
      td.state = 'scared'; st.alarmT = st.t; hud.red.classList.add('on');
      later(1.9, () => {
        st.phase = 'escape'; st.cp = 'room'; st.p.yaw = st.camYaw; st.p.pitch = st.camPitch;
        setControls(true, false); setObjective('Jump out of the window!', true); toast('Jump out of the window!', 'win', 2.5);
      });
      later(3.5, () => { if (bb.state === 'door') bb.state = 'charge'; });
    }
    function spawnFrontBits() {
      Object.assign(doorBody, { p: [0, RB_Y + 1.1, ROOM.z1], v: [(Math.random() - .5) * 1.2, 2.4, -6.2], r: [0, 0, 0], w: [-5, 1.6, .6], rest: false });
      for (const b of frontBits) { b.rest = false; b.v = [(Math.random() - .5) * 3, 1 + Math.random() * 3, -(3 + Math.random() * 5)]; b.w = [(Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8]; }
    }
    function jumpOut() {
      if (st.phase !== 'escape') return;
      const p = st.p;
      st.phase = 'jumpout'; st.jumpT = st.t; st.jumpFrom = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch };
      setControls(false); setAct(null); setObjective(''); sfx.glass(); sfx.jump(); st.glassBroken = true;
      spawnShards();
      td.state = 'gone';
      bb.state = 'window';
      later(1.65, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(2.0, () => { try { A.croak.pause(); } catch (e) {} st.alarmT = -1; hud.red.classList.remove('on'); });
      later(3.4, enterArea2);
    }
    function spawnShards() {
      for (let i = 0; i < 16; i++) shards.push({ p: [lerp(WIN.x0, WIN.x1, Math.random()), lerp(WIN.y0, WIN.y1, Math.random()), ROOM.z0], v: [(Math.random() - .5) * 2.5, Math.random() * 2, -2 - Math.random() * 3.5], r: [Math.random() * 6, Math.random() * 6, 0], w: [(Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14] });
    }
    /* ---- part two ---- */
    function enterArea2() {
      if (!ensureArea2Models()) { toast('Loading\u2026', 'load2', 1.2); later(.6, enterArea2); return; }
      st.area = 2; st.cp = 'a2'; bb.state = 'hidden'; td.state = 'gone';
      Object.assign(st.p, { x: 0, y: 0, z: 4.4, vy: 0, yaw: 0, pitch: 0, grounded: true, moving: 0 });
      st.dragYaw = st.dragPitch = 0; st.camYaw = 0; st.camPitch = 0; st.lastPZ = st.p.z;
      st.phase = 'wake2'; st.wakeT = st.t;
      hud.lids.classList.remove('on'); void hud.lids.offsetWidth; hud.lids.classList.add('on');
      later(.2, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
    }
    function beginExplore2() {
      st.phase = 'explore2'; st.p.yaw = st.camYaw; st.p.pitch = st.camPitch; st.dragYaw = st.dragPitch = 0;
      setControls(true, false); setObjective('Find a way out'); hud.lids.classList.remove('on');
      if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) { hud.keys.textContent = 'WASD / arrows to move \u00b7 drag to look \u00b7 E to use'; hud.keys.classList.add('show'); setTimeout(() => hud.keys.classList.remove('show'), 8000); }
    }
    function onAct() {
      const k = a2.act; if (!k || !controlling()) return;
      if (k === 'window') { jumpOut(); return; }
      runAct(k, null);
    }
    function runAct(k, pos) {
      if (k === 'pressL') {
        if (a2.btnL >= 0) return;
        a2.btnL = st.t; sfx.click(); setObjective('Grab the rope');
        later(.35, () => { a2.shutLT = st.t; sfx.grind(2.4); });
      } else if (k === 'grab') {
        if (a2.rope !== 'crate') return;
        a2.rope = 'hand'; sfx.pickup(); setObjective('Tie it to the middle doors');
        toast('A trap\u2026 for whatever is behind that big door.', 'trap', 3.6);
      } else if (k === 'tieL' || k === 'tieR') {
        const side = k === 'tieL' ? 'L' : 'R';
        if ((a2.rope !== 'hand' && a2.rope !== 'tied1') || a2.tie1 === side) return;
        sfx.creak(); sfx.lock();
        if (a2.rope === 'hand') { a2.rope = 'tied1'; a2.tie1 = side; setObjective('Tie it to the other door'); }
        else { a2.rope = 'tied'; st.lastPZ = st.p.z; setObjective('Press the other button'); toast('The trap is ready.', 'ready', 2.4); }
      } else if (k === 'pressR') {
        if (a2.btnR >= 0) return;
        if (a2.rope !== 'tied') { sfx.click(); sfx.buzz(); a2.buzzT = st.t; toast(a2.rope === 'crate' ? 'It won\u2019t work yet\u2026 try the other button.' : 'Finish the rope trap first\u2026', 'notyet', 2.6); return; }
        a2.btnR = st.t; sfx.click(); releaseSyringeon();
      } else if (k === 'pull') pullNaughty(pos);
      if (!pos) setAct(null);
    }
    function releaseSyringeon() {
      st.phase = 'chase2'; st.cp = 'syr'; setAct(null);
      Object.assign(sy, { state: 'emerge', x: 15.6, z: ZC, yaw: -Math.PI / 2, animT: 0, walking: false, lastZ: ZC });
      later(.4, () => { a2.shutRT = st.t; sfx.grind(3.0); });
      later(1.0, () => { playMusic(A.seneng); st.alarmT = st.t; });
      setObjective('RUN! Lead it to the rope!', true);
    }
    function syWaypoint(tx, tz) {   // where Syringeon should head next to reach (tx, tz) without cutting through walls
      const rs = region2(sy.x, sy.z), rt = region2(tx, tz);
      if (rs === rt) return [tx, tz];
      if (rs === 'H') return [0, -18.8];
      if (rs === 'L') return sy.x < -12.5 ? [-12.6, ZC] : [-11.4, ZC];
      if (rs === 'R') return sy.x > 12.5 ? [12.6, ZC] : [11.4, ZC];
      if (rt === 'H') return Math.abs(sy.x) > .9 ? [0, -19.6] : [0, -17.2];
      return rt === 'L' ? [-12.8, ZC] : [12.8, ZC];
    }
    function caughtBySyr() {
      st.phase = 'caught2'; st.caughtT = st.t; setControls(false); setAct(null); setObjective('');
      sy.state = 'catch'; sy.animT = 0; sfx.scream(); sfx.roar(1.2); shake(.05, 1.4);
      later(1.5, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(2.0, () => { st.phase = 'dead'; hud.dead.classList.add('show'); });
    }
    function springTrap() {
      a2.rope = 'snapped'; a2.trapT = st.t; sy.state = 'trip'; sy.st0 = st.t; sy.animT = 0;
      sfx.crash(); sfx.creak(); shake(.05, .8); st.cp = 'fight';
      Object.assign(rdoor, { state: 'fly', p: [H2.hw - .05, 1.15, H2.zM], v: [-6.2, 2.6, .9], r: [0, Math.PI / 2, 0], w: [2.5, 5.5, 1.2] });
      nos.forEach((n, i) => Object.assign(n, { state: 'wait', t0: st.t + .45 + i * .35, x: 3.0 + i * .35, y: 0, z: -6.5 + i * .5, hits: 0 }));
      setObjective('');
      later(1.5, () => { if (st.phase === 'chase2') st.phase = 'fight'; st.alarmT = -1; setObjective('Help Syringeon!'); toast('Pull the NaughtyOnes off him!', 'pull', 3.4); });
    }
    function attachPos(n) {
      const j = M4.xform(sy.M, syr.jointPos(n.joint)), a = sy.yaw + n.ang;
      return [j[0] + Math.sin(a) * n.off, j[1] + n.dy, j[2] + Math.cos(a) * n.off, a + Math.PI];
    }
    function pullTarget(pos) {
      if (st.phase !== 'fight') return null;
      const px = pos ? pos[0] : st.p.x, pz = pos ? pos[1] : st.p.z;
      let best = null, bd = pos ? 3.2 : 2.7;
      for (const n of nos) if (n.state === 'attached') { const d = Math.hypot(n.x - px, n.z - pz); if (d < bd) { bd = d; best = n; } }
      return best;
    }
    function pullNaughty(pos) {
      const n = pullTarget(pos); if (!n) return;
      n.hits++; n.shakeT = st.t; sfx.thud(); sfx.squeal(.8);
      if (n.hits >= 2) {
        const a = Math.atan2(n.x - sy.x, n.z - sy.z);
        Object.assign(n, { state: 'flung', vx: Math.sin(a) * 3.2 + (Math.random() - .5), vz: Math.cos(a) * 3.2, vy: 3.4, spin: (Math.random() < .5 ? -1 : 1) * 9 });
        sfx.squeal(1.3);
        if (a2.savedT < 0 && nos.every(m => m.state === 'flung' || m.state === 'flee' || m.state === 'gone')) { a2.savedT = st.t; later(1.0, syrSaved); }
      }
    }
    function syrSaved() {
      st.phase = 'saved'; setControls(false); setAct(null); setObjective(''); sy.state = 'saved'; st.alarmT = -1;
      later(1.4, () => { toast('Syringeon: \u201cThanks for helping me!\u201d', 'thanks', 4.4); speak('Thanks for helping me!'); });
      later(5.6, () => { sfx.rumble(); a2.quakeT = st.t; shake(.03, 1.6); toast('\u2026what was that?', 'rumble', 1.8); });
      later(6.8, () => boomAt([3.4, 1.4, -6.2], 1));
      later(7.5, () => boomAt([0, 1.6, -14], 1.3));
      later(8.1, () => boomAt([st.p.x, 1.5, st.p.z - 2.2], 2.2));
      later(8.7, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(10.0, () => { st.phase = 'done'; hud.end.classList.add('show'); opts.onComplete && opts.onComplete(); });
    }
    function boomAt(c, k) {
      sfx.boom(); shake(.09 * k, 1.4);
      hud.flash.classList.remove('go'); void hud.flash.offsetWidth; hud.flash.classList.add('go');
      for (let i = 0; i < 10; i++) a2.fires.push({ p: [c[0] + (Math.random() - .5) * 1.8 * k, c[1] + (Math.random() - .3) * 1.2 * k, c[2] + (Math.random() - .5) * 1.8 * k], v: [(Math.random() - .5) * 2, .8 + Math.random() * 1.6, (Math.random() - .5) * 2], t0: st.t + i * .045, size: (1.4 + Math.random() * 1.6) * k, life: 1.5 + Math.random() * .9 });
    }

    /* ---- updates ---- */
    function updatePlayer(t, dt) {
      const p = st.p;
      if (controlling()) {
        let mx = joy.x, my = joy.y;
        if (keys.f) my -= 1; if (keys.b) my += 1; if (keys.l) mx -= 1; if (keys.r) mx += 1;
        const mag = Math.min(1, Math.hypot(mx, my));
        if (mag > .06) {
          const n = Math.hypot(mx, my), ux = mx / n * mag, uy = my / n * mag;
          const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
          const sp = { chase: 5.4, follow: 3.6, escape: 3.8, chase2: 5.0, fight: 3.2, explore2: 2.7 }[st.phase] || 2.4;
          const mx2 = (fx * -uy + rx * ux) * sp * dt, mz2 = (fz * -uy + rz * ux) * sp * dt, n2 = Math.max(1, Math.ceil(Math.hypot(mx2, mz2) / .12));
          for (let k = 0; k < n2; k++) { p.x += mx2 / n2; p.z += mz2 / n2; collide(p); }   // small steps so thin junk can't be skipped
        }
        p.moving = lerp(p.moving, mag > .06 && p.grounded ? mag : 0, Math.min(1, dt * 8));
        p.bob += dt * p.moving * (st.phase === 'chase' ? 12 : 7.5);
        const s = Math.sin(p.bob) > 0 ? 1 : -1;
        if (p.moving > .3 && s !== p.lastStep) { p.lastStep = s; sfx.pstep(.3 + p.moving * .3); }
        if (st.phase === 'explore') {
          const fz = -Math.cos(p.yaw);
          if (p.z > 0 && fz > .4) toast("You can't go back down", 'ladder');
          if (p.z < -7.2) startFreeze();
        }
        if (st.phase === 'chase') {
          for (let i = C2_CHECKPOINTS.length - 1; i > st.cp; i--) if (p.z < C2_CHECKPOINTS[i][2] + .5) { st.cp = i; break; }
          if (!st.handSaid && p.z < -60) { st.handSaid = true; playVoice(A.hand); toast('\u201cJump! I\u2019ll catch you!\u201d', 'hand', 3.5); }
          const ne = nearEdge(); hud.jump.classList.toggle('big', ne); hud.jump.classList.add('show');
          if (ne) toast('JUMP!', 'jump', 2);
        }
        if (st.phase === 'follow' && p.z < ROOM.z1 - 1.5 && p.x > ROOM.x0 && p.x < ROOM.x1 && td.state === 'inside') startClose();
        if (st.phase === 'escape') setAct(p.z < ROOM.z0 + 1.5 && Math.abs(p.x) < 1.4 ? 'window' : null);
        if (st.area === 2) updateArea2Player(t, dt);
      }
      // gravity
      if (st.phase !== 'leap' && st.phase !== 'hang' && st.phase !== 'pull') {
        let g = groundAt(p.x, p.z, p.y); if (!isFinite(g)) g = p.y;
        if (p.y > g + 1e-3 || p.vy > 0) { p.vy -= 20 * dt; p.y += p.vy * dt; if (p.y <= g) { if (p.vy < -5) sfx.land(.6); p.y = g; p.vy = 0; } }
        else { p.y = g; p.vy = 0; }
        p.grounded = p.y <= g + 1e-3;
      }
    }
    function updateArea2Player(t, dt) {
      const p = st.p, near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
      let act = null;
      if (st.phase === 'explore2' || st.phase === 'chase2') {
        if (a2.btnL < 0 && near(BTN_L[0], BTN_L[2] + .5, 1.6)) act = 'pressL';
        else if (a2.btnR < 0 && near(BTN_R[0], BTN_R[2] + .5, 1.6)) act = 'pressR';
        else if (a2.rope === 'crate' && a2.shutL > .55 && near(-14.9, ZC, 1.8)) act = 'grab';
        else if ((a2.rope === 'hand' || a2.rope === 'tied1') && Math.abs(p.z - KNOT_L[2]) < 1.5) {
          if (p.x < -.3 && a2.tie1 !== 'L') act = 'tieL'; else if (p.x > .3 && a2.tie1 !== 'R') act = 'tieR';
        }
      }
      if (st.phase === 'fight' && pullTarget()) act = 'pull';
      setAct(act);
      if (st.phase === 'explore2') {
        if (rdoor.state === 'shut' && Math.abs(p.z - H2.zM) < 2.6) {
          if (t > a2.scratchT) { a2.scratchT = t + 1.1 + Math.random() * 1.6; sfx.scratch(.9); a2.doorShakeT = t; }
          if (p.x > .2 && !a2.said.scratch) { a2.said.scratch = 1; toast('Something is scratching behind this door\u2026', 'scratch', 3.2); }
          else if (p.x < -.2 && !a2.said.locked && a2.rope === 'crate') { a2.said.locked = 1; toast('This door is locked.', 'locked', 2.2); }
        }
        if (a2.btnR < 0 && p.x > 9 && !a2.said.breath) { a2.said.breath = 1; toast('Something huge is breathing behind this door\u2026', 'breath', 3.2); sfx.growl(.5); }
      }
      if (a2.rope === 'tied' && Math.abs(p.x) < H2.hw && (st.lastPZ - KNOT_L[2]) * (p.z - KNOT_L[2]) < 0) { a2.hopT = t; sfx.jump(); }
      st.lastPZ = p.z;
    }
    function poseSyr(t) {
      if (!syr) return;
      let L;
      if (sy.state === 'emerge') L = sy.walking ? [['walk', sy.animT, 1]] : [['idle', sy.animT, 1]];
      else if (sy.state === 'roar') L = [['scare', Math.min(sy.animT * .5, .3), 1, true]];
      else if (sy.state === 'chase') L = [['run', sy.animT, 1]];
      else if (sy.state === 'catch') L = [['scare', .25 + sy.animT * 1.1, 1, true]];
      else if (sy.state === 'trip' || sy.state === 'struggle') L = [['idle', sy.animT * 3, .45], ['run', sy.animT * 1.3, .55]];
      else L = [['idle', sy.animT, 1]];
      syr.setAnim(L);
      const lift = Math.min(syr.jointPos('FootL')[1], syr.jointPos('FootR')[1]) - S_FEET;
      let yaw = sy.yaw, tilt = 0;
      if (sy.state === 'trip' || sy.state === 'struggle') { const k = nos.filter(n => n.state === 'attached').length / 3 + (sy.state === 'trip' ? .6 : 0); yaw += Math.sin(t * 5.3) * .32 * k; tilt = Math.sin(t * 7.1) * .07 * k; }
      sy.M = M4.mul(M4.trs([sy.x, 0, sy.z], Q.mul(Q.aa(0, 1, 0, yaw), Q.aa(0, 0, 1, tilt)), [S_SC, S_SC, S_SC]), M4.trs([S_OFF[0], S_OFF[1] - lift, S_OFF[2]], [0, 0, 0, 1], [1, 1, 1]));
    }
    function updateSyr(t, dt) {
      if (sy.state === 'hidden' || !syr) return;
      const p = st.p, dx = p.x - sy.x, dz = p.z - sy.z, d = Math.hypot(dx, dz);
      sy.lastZ = sy.z;
      const vol = clamp(1.6 / (1 + d * .2), 0, 1);
      if (sy.state === 'emerge') {
        sy.animT += dt;
        if (a2.shutR > .72) {
          if (!sy.walking) { sy.walking = true; sy.animT = 0; }
          if (sy.x > 11.0) sy.x = Math.max(11.0, sy.x - 1.5 * dt);
          else { sy.state = 'roar'; sy.animT = 0; sy.roarT = t; sfx.roar(1.3); shake(.02, 1); }
          if (t > sy.stepT) { sy.stepT = t + .6; sfx.step(vol); }
        }
        sy.yaw = lerpAngle(sy.yaw, -Math.PI / 2, Math.min(1, dt * 4));
        if (d < 1.3 && st.phase === 'chase2') caughtBySyr();
      } else if (sy.state === 'roar') {
        sy.animT += dt; sy.yaw = lerpAngle(sy.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
        if (t - sy.roarT > 1.4) { sy.state = 'chase'; sy.animT = 0; }
      } else if (sy.state === 'chase') {
        const w = syWaypoint(p.x, p.z), wx = w[0] - sy.x, wz = w[1] - sy.z, wd = Math.hypot(wx, wz), sp = 4.4;
        if (wd > 1e-3) { const k = Math.min(1, sp * dt / wd); sy.x += wx * k; sy.z += wz * k; sy.yaw = lerpAngle(sy.yaw, Math.atan2(wx, wz), Math.min(1, dt * 7)); }
        sy.animT += dt * sp / 4.6;
        if (t > sy.stepT) { sy.stepT = t + .31; sfx.step(vol); }
        if (t > sy.growlT) { sy.growlT = t + 2.6 + Math.random() * 2; sfx.growl(vol); }
        if (d < 1.3 && st.phase === 'chase2') caughtBySyr();
        else if (a2.rope === 'tied' && region2(sy.x, sy.z) === 'H' && sy.lastZ < KNOT_L[2] && sy.z >= KNOT_L[2]) springTrap();
      } else if (sy.state === 'catch') {
        sy.animT += dt; sy.yaw = lerpAngle(sy.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
        if (Math.abs(d - 1.7) > .05) { const k = Math.min(1, 3 * dt * Math.sign(d - 1.7) / d); sy.x += dx * k; sy.z += dz * k; }
      } else if (sy.state === 'trip' || sy.state === 'struggle') {
        sy.animT += dt; if (sy.state === 'trip' && t - sy.st0 > .7) sy.state = 'struggle';
        if (t > sy.growlT) { sy.growlT = t + 1.6 + Math.random() * 1.6; sfx.growl(.9); }
      } else if (sy.state === 'saved') { sy.animT += dt; sy.yaw = lerpAngle(sy.yaw, Math.atan2(dx, dz), Math.min(1, dt * 2.5)); }
      poseSyr(t);
    }
    function updateNaughty(t, dt) {
      if (!nrig) return;
      for (const n of nos) {
        if (n.state === 'hidden' || n.state === 'gone') continue;
        if (n.state === 'wait') { if (t >= n.t0) { n.state = 'leap'; n.lt = t; n.from = [n.x, n.y, n.z]; sfx.squeal(.8); } else continue; }
        n.animT += dt * (n.state === 'attached' ? 3 : 1.4);
        if (n.state === 'leap') {
          const k = clamp((t - n.lt) / .6, 0, 1), g = attachPos(n);
          n.x = lerp(n.from[0], g[0], k); n.z = lerp(n.from[2], g[2], k); n.y = lerp(n.from[1], g[1], k) + Math.sin(Math.PI * k) * 1.1;
          n.yaw = lerpAngle(n.yaw, k < .8 ? Math.atan2(g[0] - n.from[0], g[2] - n.from[2]) : g[3], Math.min(1, dt * 10)); n.rx = -.6 * Math.sin(Math.PI * k);
          if (k >= 1) { n.state = 'attached'; sfx.thud(); n.biteT = t + .3; }
        } else if (n.state === 'attached') {
          const g = attachPos(n), sh = t - n.shakeT < .35 ? Math.sin(t * 60) * .07 : 0;
          n.x = g[0] + sh; n.y = g[1] + Math.abs(Math.sin(t * 9 + n.animT)) * .05; n.z = g[2]; n.yaw = g[3] + Math.sin(t * 13 + n.ang) * .2; n.rx = .25 + Math.sin(t * 11 + n.ang) * .15;
          if (t > n.biteT) { n.biteT = t + .45 + Math.random() * .7; sfx.squeal(.3); }
        } else if (n.state === 'flung') {
          n.vy -= 14 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; n.rx += n.spin * dt;
          n.x = clamp(n.x, -H2.hw + .3, H2.hw - .3);
          if (n.y <= 0 && n.vy < 0) { n.y = 0; n.rx = 0; n.state = 'flee'; }
        } else if (n.state === 'flee') {
          const tx = n.x < H2.hw - .25 ? H2.hw : 4.2, tz = H2.zM, dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
          if (d < .2 && tx > 4) n.state = 'gone';
          else { const k = Math.min(1, 2.8 * dt / Math.max(d, 1e-3)); n.x += dx * k; n.z += dz * k; n.yaw = lerpAngle(n.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10)); }
        }
      }
    }
    function updateA2Bits(t, dt) {
      a2.shutL = a2.shutLT < 0 ? 0 : smooth(a2.shutLT, a2.shutLT + 2.4, t);
      a2.shutR = a2.shutRT < 0 ? 0 : smooth(a2.shutRT, a2.shutRT + 3.0, t);
      if (rdoor.state === 'fly') {
        rdoor.v[1] -= 16 * dt; for (let i = 0; i < 3; i++) { rdoor.p[i] += rdoor.v[i] * dt; rdoor.r[i] += rdoor.w[i] * dt; }
        if (rdoor.p[0] < -H2.hw + .4) { rdoor.p[0] = -H2.hw + .4; rdoor.v[0] *= -.3; }
        if (rdoor.p[1] < .1 && rdoor.v[1] < 0) { rdoor.p[1] = .1; rdoor.state = 'down'; rdoor.r = [Math.PI / 2, rdoor.r[1], 0]; sfx.land(1.4); }
      }
      for (const f of a2.fires) { const k = t - f.t0; if (k > 0) for (let i = 0; i < 3; i++) f.p[i] += f.v[i] * dt * .5; }
      a2.fires = a2.fires.filter(f => t - f.t0 < f.life);
    }
    function updateRoomBits(dt) {
      const fall = (b, floorY, half) => {
        if (b.rest) return;
        b.v[1] -= 18 * dt; for (let i = 0; i < 3; i++) { b.p[i] += b.v[i] * dt; b.r[i] += b.w[i] * dt; }
        b.p[0] = clamp(b.p[0], ROOM.x0 + .3, ROOM.x1 - .3); b.p[2] = Math.max(b.p[2], ROOM.z0 + .3);
        if (b.p[1] < floorY + half) { b.p[1] = floorY + half; b.v[1] *= -.2; b.v[0] *= .5; b.v[2] *= .5; b.w = b.w.map(w => w * .5); if (Math.abs(b.v[1]) < .6) { b.rest = true; } }
      };
      if (st.frontBroken) { for (const b of frontBits) fall(b, RB_Y, .11); fall(doorBody, RB_Y, .05); if (doorBody.rest) doorBody.r[0] = lerp(doorBody.r[0], -Math.PI / 2, .3); }
      for (const sd of shards) { sd.v[1] -= 14 * dt; for (let i = 0; i < 3; i++) { sd.p[i] += sd.v[i] * dt; sd.r[i] += sd.w[i] * dt; } }
    }
    function updateBanban(t, dt) {
      if (bb.state === 'hidden') return;
      bb.roar = lerp(bb.roar, bb.state === 'roarIn' || bb.state === 'roar' || bb.state === 'grab' || bb.state === 'door' || bb.state === 'window' ? 1 : 0, Math.min(1, dt * 6));
      bb.lean = lerp(bb.lean || 0, bb.state === 'window' ? 1 : 0, Math.min(1, dt * 4));
      if (bb.state === 'door') { bb.run = lerp(bb.run, 0, Math.min(1, dt * 6)); bb.yaw = lerpAngle(bb.yaw, Math.atan2(st.p.x - bb.x, st.p.z - bb.z), Math.min(1, dt * 5)); if (t > bb.growlT) { bb.growlT = t + 1.4; sfx.growl(1); } return; }
      if (bb.state === 'charge') {
        const p = st.p, dx = p.x - bb.x, dz = p.z - bb.z, d = Math.hypot(dx, dz), sp = 2.6;
        if (d > .01) { const k = Math.min(1, sp * dt / d); bb.x += dx * k; bb.z += dz * k; }
        if (bb.z < ROOM.z1 - .25) { bb.x = clamp(bb.x, ROOM.x0 + .7, ROOM.x1 - .7); bb.z = Math.max(bb.z, ROOM.z0 + .7); } else bb.x = clamp(bb.x, -.8, .8);
        bb.yaw = lerpAngle(bb.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8)); bb.run = lerp(bb.run, 1, Math.min(1, dt * 4)); bb.ph += dt * Math.PI * 2 * sp / 2.3;
        if (t > bb.stepT) { bb.stepT = t + .24; sfx.step(.9); }
        if (t > bb.growlT) { bb.growlT = t + 1.8 + Math.random(); sfx.growl(1); }
        if (st.phase === 'escape' && d < 1.25) caughtByBanban();
        return;
      }
      if (bb.state === 'window') {
        const tx = 0, tz = ROOM.z0 + 1.6, dx = tx - bb.x, dz = tz - bb.z, d = Math.hypot(dx, dz);
        if (d > .05) { const k = Math.min(1, 6 * dt / d); bb.x += dx * k; bb.z += dz * k; bb.run = lerp(bb.run, 1, Math.min(1, dt * 6)); bb.ph += dt * 14; }
        else bb.run = lerp(bb.run, 0, Math.min(1, dt * 6));
        bb.yaw = lerpAngle(bb.yaw, Math.PI, Math.min(1, dt * 8));
        if (t > bb.growlT) { bb.growlT = t + .9; sfx.roar(.8); }
        return;
      }
      if (bb.state === 'burst' || bb.state === 'roarIn') {
        bb.s = Math.min(bb.s + 3.5 * dt, 2.4); const q = pathAt(bb.s); bb.x = q[0]; bb.y = q[1]; bb.z = q[2]; bb.yaw = q[3]; bb.run = lerp(bb.run, bb.state === 'burst' ? .8 : .1, Math.min(1, dt * 5)); bb.ph += dt * 9 * bb.run;
        return;
      }
      if (bb.state === 'grab') { bb.run = lerp(bb.run, 0, Math.min(1, dt * 6)); bb.yaw = lerpAngle(bb.yaw, Math.atan2(st.p.x - bb.x, st.p.z - bb.z), Math.min(1, dt * 8)); return; }
      if (bb.state === 'roar') { bb.run = lerp(bb.run, 0, Math.min(1, dt * 4)); if (t > bb.growlT) { bb.growlT = t + 3 + Math.random() * 2; sfx.roar(.7); } return; }
      if (bb.state !== 'run' || st.phase === 'dead') return;
      const p = st.p, endS = PATH_S[PATH_S.length - 1];
      const gap = pathSOfZ(p.z) - bb.s, d3 = Math.hypot(p.x - bb.x, p.z - bb.z);
      const sp = st.phase === 'freeze' ? 4.0 : gap > 14 ? 6.0 : gap > 8 ? 4.8 : 4.25;
      if (d3 < 3 && Math.abs(p.y - bb.y) < 1 && st.phase === 'chase') {
        const k = Math.min(1, sp * dt / Math.max(d3, 1e-3)); bb.x += (p.x - bb.x) * k; bb.z += (p.z - bb.z) * k; bb.yaw = Math.atan2(p.x - bb.x, p.z - bb.z); bb.s = Math.max(bb.s, pathSOfZ(bb.z));
      } else {
        bb.s = Math.min(endS, bb.s + sp * dt); const q = pathAt(bb.s); bb.x = q[0]; bb.y = q[1]; bb.z = q[2]; bb.yaw = lerpAngle(bb.yaw, q[3], Math.min(1, dt * 8));
      }
      bb.run = lerp(bb.run, 1, Math.min(1, dt * 4)); bb.ph += dt * Math.PI * 2 * sp / 2.3;
      const vol = clamp(1.6 / (1 + d3 * .22), 0, 1);
      if (t > bb.stepT) { bb.stepT = t + .19; sfx.step(vol * .9); }
      if (t > bb.growlT) { bb.growlT = t + 2.4 + Math.random() * 2; sfx.growl(vol); }
      if (st.phase === 'chase' && d3 < 1.3 && Math.abs(p.y - bb.y) < 1.2) caughtByBanban();
      if (bb.s >= endS - .01) { bb.state = 'roar'; bb.growlT = t + .5; sfx.roar(1); }
    }
    function updateToad(t, dt) {
      if (td.state === 'run') {
        const w = TD_ROUTE[td.wp], dx = w[0] - td.x, dz = w[1] - td.z, d = Math.hypot(dx, dz), sp = 4.2;
        if (d < .15) { td.wp++; if (td.wp >= TD_ROUTE.length) { td.state = 'inside'; td.run = 0; } }
        else { const k = Math.min(1, sp * dt / d); td.x += dx * k; td.z += dz * k; td.yaw = lerpAngle(td.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
        td.run = lerp(td.run, 1, Math.min(1, dt * 5)); td.ph += dt * Math.PI * 2 * sp / 2.6;
      } else if (td.state === 'scared') {
        const tx = 2.2, tz = -99.6, dx = tx - td.x, dz = tz - td.z, d = Math.hypot(dx, dz);
        if (d > .1) { const k = Math.min(1, 1.2 * dt / d); td.x += dx * k; td.z += dz * k; }
        td.run = lerp(td.run, d > .1 ? .35 : 0, Math.min(1, dt * 5)); td.ph += dt * 4;
        td.yaw = lerpAngle(td.yaw, Math.atan2(bb.x - td.x, bb.z - td.z), Math.min(1, dt * 5));
      } else if (td.state === 'inside' || td.state === 'close') {
        td.run = lerp(td.run, 0, Math.min(1, dt * 5));
        const tx = st.p.x - td.x, tz = st.p.z - td.z;
        td.yaw = lerpAngle(td.yaw, td.state === 'close' ? Math.atan2(-.6 - td.x, ROOM.z1 + .2 - td.z) : Math.atan2(tx, tz), Math.min(1, dt * 5));
      }
      if (st.closeT >= 0) st.doorAng = Math.PI / 2 * (1 - smooth(st.closeT + .2, st.closeT + .75, t));
    }
    function updateChunks(dt) {
      for (const c of chunks) {
        if (c.rest) continue;
        c.v[1] -= 18 * dt; for (let i = 0; i < 3; i++) { c.p[i] += c.v[i] * dt; c.r[i] += c.w[i] * dt; }
        c.p[0] = clamp(c.p[0], -HW + .3, HW - .3);
        if (c.p[1] < .3) { c.p[1] = .3; c.v[1] *= -.25; c.v[0] *= .6; c.v[2] *= .6; c.w = c.w.map(w => w * .6); if (Math.abs(c.v[1]) < .5 && Math.hypot(c.v[0], c.v[2]) < .3) c.rest = true; }
      }
    }

    /* ---- camera ---- */
    function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
    function updateCamera(t, dt) {
      const p = st.p; let eye, yaw, pitch;
      if (st.phase === 'wake' || st.phase === 'wake2') {
        const k = t - st.wakeT;
        eye = [p.x, lerp(.3, 1.62, smooth(2.4, 4.6, k)), p.z];
        if (lookId === null) { st.dragYaw *= .99; st.dragPitch *= .99; }
        yaw = st.dragYaw; pitch = clamp(lerp(1.1, -.04, smooth(1.6, 4.4, k)) + st.dragPitch, -1.2, 1.4);
        if (k > 4.8) { st.camYaw = yaw; st.camPitch = pitch; st.eye = eye; if (st.phase === 'wake2') beginExplore2(); else beginExplore(); }
      } else if (st.phase === 'freeze') {
        const k = t - st.freezeT, sh = .02 * (1 - smooth(1.5, 2.5, k)) + .03 * smooth(1.85, 1.95, k) * (1 - smooth(2.4, 3.4, k));
        eye = [p.x + Math.sin(t * 53) * sh, p.y + 1.62 + Math.sin(t * 61) * sh, p.z];
        const back = smooth(.5, 1.6, k) * (1 - smooth(3.15, 3.8, k));
        yaw = lerpAngle(st.turnFrom, Math.PI, back); if (k > 3.15) yaw = lerpAngle(Math.PI, 0, smooth(3.15, 3.8, k));
        pitch = lerp(st.pitchFrom, .05, smooth(.5, 1.6, k));
      } else if (st.phase === 'leap') {
        const f = st.leapFrom, k = clamp((t - st.leapT) / 1.15, 0, 1);
        eye = [lerp(f.x, td.x, k), f.y + 1.62 + 1.2 * Math.sin(Math.PI * .85 * k) - 2.35 * k * k, lerp(f.z, GAP1 + .34, k)];
        yaw = lerpAngle(f.yaw, 0, Math.min(1, k * 2)); pitch = lerp(0, -.35, k);
        if (k >= 1) { st.phase = 'hang'; st.hangT = t; sfx.land(1.5); sfx.thud(); toast('', 'none', .1); }
      } else if (st.phase === 'hang' || st.phase === 'pull') {
        const k = st.phase === 'hang' ? 0 : smooth(0, 1.3, t - st.pullT), sh = st.phase === 'hang' ? .03 * Math.exp(-(t - st.hangT) * 3) : 0;
        const hangY = RB_Y - .3;
        eye = [td.x + Math.sin(t * 50) * sh, lerp(hangY, RB_Y + 1.62, k) + Math.sin(k * Math.PI) * .25, lerp(GAP1 + .34, GAP1 - 1.6, k)];
        yaw = 0; pitch = lerp(.95, .05, k);
        if (st.phase === 'hang' && t - st.hangT > 1.4) { st.phase = 'pull'; st.pullT = t; sfx.land(.8); }
        if (st.phase === 'pull' && t - st.pullT > 1.35) {
          Object.assign(p, { x: eye[0], y: RB_Y, z: eye[2], vy: 0, yaw: 0, pitch: .05, grounded: true });
          st.phase = 'follow'; td.state = 'run'; td.wp = 0; setControls(true, false); setObjective('Follow the sheriff!');
        }
      } else if (st.phase === 'jumpout') {
        const f = st.jumpFrom, k = t - st.jumpT, a = smooth(0, .4, k), wy = (WIN.y0 + WIN.y1) / 2 - .1, u = Math.max(0, k - .4);
        eye = [lerp(f.x, 0, a), lerp(f.y + 1.62, wy, a) + 1.4 * u - 5.5 * u * u, lerp(f.z, ROOM.z0 - .4, a) - 2.4 * u];
        yaw = lerpAngle(lerpAngle(f.yaw, 0, a), Math.PI, smooth(.45, 1.15, k)); pitch = lerp(lerp(f.pitch, -.05, a), .85, smooth(.45, 1.2, k));
      } else if (st.phase === 'caught2' || st.phase === 'saved' || (st.area === 2 && (st.phase === 'dead' || st.phase === 'done'))) {
        eye = [p.x, p.y + 1.62, p.z];
        let hx = sy.x, hy = 2.3, hz = sy.z;
        if (syr) { const h = M4.xform(sy.M, syr.jointPos('Head')); hx = h[0]; hy = h[1] - (st.phase === 'saved' ? .3 : 0); hz = h[2]; }
        const dx = hx - eye[0], dz = hz - eye[2], r = st.phase === 'caught2' ? 10 : 2.5;
        yaw = lerpAngle(st.camYaw, Math.atan2(dx, -dz), Math.min(1, dt * r)); pitch = lerp(st.camPitch, clamp(Math.atan2(hy - eye[1], Math.hypot(dx, dz)), -1, 1.1), Math.min(1, dt * r));
      } else if (st.phase === 'caught' || st.phase === 'dead') {
        const k = t - st.caughtT, sh = .045 * Math.exp(-k * 1.2);
        eye = [p.x + Math.sin(t * 47) * sh, p.y + 1.62 + Math.sin(t * 59) * sh, p.z];
        yaw = lerpAngle(st.camYaw, Math.atan2(bb.x - p.x, -(bb.z - p.z)), Math.min(1, dt * 10)); pitch = lerp(st.camPitch, .38, Math.min(1, dt * 6));
      } else if (st.phase === 'closing' || st.phase === 'done') {
        eye = [p.x, p.y + 1.62, p.z];
        const turn = st.frontBroken && t - st.frontT > 1.15;   // after the door bursts: spin round to face the window
        yaw = lerpAngle(st.camYaw, turn ? 0 : Math.atan2(0 - p.x, -(ROOM.z1 - p.z)), Math.min(1, dt * (turn ? 5 : 3))); pitch = lerp(st.camPitch, turn ? -.03 : .08, Math.min(1, dt * 3));
      } else {
        eye = [p.x, p.y + 1.62 + Math.sin(p.bob * 2) * .04 * p.moving, p.z]; yaw = p.yaw; pitch = p.pitch;
      }
      const sk = st.shk.amp * Math.max(0, 1 - (t - st.shk.t0) / st.shk.dur);
      if (sk > 0) eye = [eye[0] + Math.sin(t * 53) * sk, eye[1] + Math.sin(t * 61) * sk, eye[2] + Math.sin(t * 47) * sk * .6];
      if (st.area === 2 && t - a2.hopT < .45) eye = [eye[0], eye[1] + Math.sin(Math.PI * (t - a2.hopT) / .45) * .2, eye[2]];
      st.eye = eye; st.camYaw = yaw; st.camPitch = pitch;
    }

    /* ---- lights ---- */
    const LIGHTS = [];
    HALL_LAMPS.forEach(([z, s], i) => LIGHTS.push({ kind: 'hall', i, p: [s * (HW - .3), 2.55, z], r: 7 }));
    [[-12], [-22]].forEach(([z], i) => LIGHTS.push({ kind: 'beacon', i, p: [0, HH - .4, z], r: 7 }));
    LIGHTS.push({ kind: 'cavity', p: [0, 1.6, Z_HBACK + 2.5], r: 7 });
    ROOF_LAMPS.forEach(([x, y, z]) => LIGHTS.push({ kind: 'roof', p: [x - Math.sign(x) * .9, y + 2.85, z], r: 14 }));
    LIGHTS.push({ kind: 'bigbeacon', p: [0, 9.6, -27], r: 26 });
    LIGHTS.push({ kind: 'room', p: [0, RB_Y + ROOM.h - .45, -97.5], r: 8 }, { kind: 'roomdoor', p: [0, RB_Y + 2.2, ROOM.z1 + .45], r: 6 });
    LIGHTS.push({ kind: 'alley', p: [-2.5, STREET + 5, -75], r: 16 }, { kind: 'alley', p: [3, STREET + 5, -77.5], r: 16 });
    LIGHTS.push({ kind: 'edge', p: [0, RB_Y + 2.2, GAP1 + 2.2], r: 9 });
    const LIGHTS2 = [];
    HALL2_LAMPS.forEach(([x, z], i) => LIGHTS2.push({ kind: 'tube', i, p: [x, H2.h - .3, z], r: 8 }));
    LIGHTS2.push({ kind: 'ropeRoom', p: [-14.5, ROPE_ROOM.h - .3, ZC], r: 7 }, { kind: 'syrRoom', p: [15, SYR_ROOM.h - .35, -20], r: 9 });
    LIGHTS2.push({ kind: 'btn', i: 0, p: [BTN_L[0], BTN_L[1], BTN_L[2] + .35], r: 2.2 }, { kind: 'btn', i: 1, p: [BTN_R[0], BTN_R[1], BTN_R[2] + .35], r: 2.2 });
    LIGHTS2.push({ kind: 'nroom', p: [3.6, 1.6, H2.zM], r: 5 });
    const Lpos = new Float32Array(24), Lcol = new Float32Array(24), Lrange = new Float32Array(8); let Ln = 0;
    let am = 0, pulse = 0, flick = 1;
    const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const sc3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    function updateLights(t) {
      am = st.alarmT < 0 ? 0 : smooth(st.alarmT, st.alarmT + .4, t) * (st.phase === 'done' ? 0 : 1);
      pulse = .5 + .5 * Math.sin(t * 6.5); flick = (Math.sin(t * 31) > .94 || (t % 6.1) < .1) ? .2 : 1;
      const cand = [];
      const qf = st.area === 2 && st.t - a2.quakeT < 2.4 ? (Math.sin(st.t * 37) > .3 ? 1 : .25) : 1;
      for (const L of (st.area === 2 ? LIGHTS2 : LIGHTS)) {
        let c;
        if (L.kind === 'hall') c = mix3(sc3([1, .66, .36], 2.7 * (L.i === 3 ? flick : 1)), sc3([1, .06, .03], 2.2 * (.4 + .6 * (.5 + .5 * Math.sin(t * 6.5 + L.i)))), am);
        else if (L.kind === 'beacon') { const a = t * 5 + L.i * 2; L.p = [Math.cos(a) * .9, HH - .45, (L.i ? -22 : -12) + Math.sin(a) * .9]; c = sc3([1, .06, .03], 2.8 * am); }
        else if (L.kind === 'cavity') c = st.broken ? [1.6 * (.6 + .4 * pulse), .12, .06] : [0, 0, 0];
        else if (L.kind === 'roof') c = [2.6, 1.35, .5];
        else if (L.kind === 'bigbeacon') c = sc3([1, .05, .03], 6 * am * (.3 + .7 * Math.abs(Math.sin(t * 3))));
        else if (L.kind === 'room') c = [2.4, 1.8, 1.1];
        else if (L.kind === 'roomdoor') c = st.frontBroken ? [0, 0, 0] : [1.6, 1.2, .7];
        else if (L.kind === 'tube') c = sc3(mix3([1.45, 1.55, 1.7], sc3([1.6, .08, .05], .45 + .55 * pulse), am * .75), (L.i === 2 ? flick : 1) * qf);
        else if (L.kind === 'ropeRoom') c = sc3([2.0, 1.5, .9], qf);
        else if (L.kind === 'syrRoom') c = [1.9 * (.35 + .65 * a2.shutR), .12, .08];
        else if (L.kind === 'btn') { const on = L.i ? a2.btnR >= 0 : a2.btnL >= 0; c = on ? [.1, 1.1, .3] : [1.3, .07, .04]; }
        else if (L.kind === 'nroom') c = rdoor.state === 'shut' ? [0, 0, 0] : [.7, .25, 1.0];
        else if (L.kind === 'edge') c = [1.5, 1.45, 1.6];
        else c = [3, 1.6, .6];
        const d = Math.hypot(L.p[0] - st.eye[0], L.p[1] - st.eye[1], L.p[2] - st.eye[2]);
        if (d > 60 || c[0] + c[1] + c[2] < .02) continue;
        cand.push({ L, c, s: d - L.r * .5 });
      }
      if (st.area === 2) for (const f of a2.fires) { const k = t - f.t0; if (k < 0) continue; const e = Math.max(0, 1 - k / f.life); cand.push({ L: { p: f.p, r: 6 + f.size * 3 }, c: [7 * e, 3 * e, .8 * e], s: -10 + k }); }
      cand.sort((u, w) => u.s - w.s); Ln = Math.min(8, cand.length);
      for (let i = 0; i < Ln; i++) { Lpos.set(cand[i].L.p, i * 3); Lcol.set(cand[i].c, i * 3); Lrange[i] = cand[i].L.r; }
    }

    /* ---- render ---- */
    let raf = 0, alive = true, emaDt = 1 / 60, resScale = 1, lastScaleT = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale, w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    const I = M4.ident();
    function frame(t, noDraw) {
      const dt = clamp(t - st.t, 0, .1); st.t = t;
      if (!noDraw && dt > 0) { emaDt = lerp(emaDt, dt, .05); if (t - lastScaleT > 1.5 && emaDt > .036 && resScale > .55) { resScale *= .85; lastScaleT = t; } }
      for (let n = 0; n < 50; n++) { let k = -1; for (let i = 0; i < st.timers.length; i++) if (t >= st.timers[i].at && (k < 0 || st.timers[i].at < st.timers[k].at)) k = i; if (k < 0) break; const f = st.timers[k].fn; st.timers.splice(k, 1); f(); }   // earliest first, even on a slow frame
      if (st.toastUntil && t > st.toastUntil) { hud.toast.classList.remove('show'); st.toastUntil = 0; }
      updatePlayer(t, dt);
      updateBanban(t, dt); updateToad(t, dt);
      updateChunks(dt); updateRoomBits(dt);
      if (st.area === 1 && st.p.z < -88) ensureArea2Models();
      if (st.area === 2) { updateSyr(t, dt); updateNaughty(t, dt); updateA2Bits(t, dt); }
      if (st.p.z < -40 || st.phase === 'leap') ensureToad();
      updateCamera(t, dt); updateLights(t);
      const inside = st.area === 2 || (st.eye[2] > Z_HEND - .2 && Math.abs(st.eye[0]) < HW + .1);
      sfx.siren(st.area === 2 ? 0 : am * (inside ? 1 : .6), t);
      sfx.setHum(inside ? .3 + (flick < .5 ? .6 : 0) : 0);
      if (noDraw) return;

      resize();
      const asp = canvas.width / canvas.height, vfov = clamp(2 * Math.atan(Math.tan(31 * D) / asp), 58 * D, 92 * D);
      const eye = st.eye, yaw = st.camYaw, pitch = st.camPitch;
      const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const view = opts.debugCam ? M4.lookAt(opts.debugCam.eye, opts.debugCam.target, [0, 1, 0]) : M4.lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
      const VP = M4.mul(M4.persp(vfov, asp, .05, 220), view), camPos = opts.debugCam ? opts.debugCam.eye : eye;
      const inRoom = eye[0] > ROOM.x0 && eye[0] < ROOM.x1 && eye[2] < ROOM.z1 && eye[2] > ROOM.z0;
      const amb = st.area === 2 ? mix3([.05, .05, .058], [.14, .02, .015], am * .6) : inside ? mix3([.055, .052, .055], sc3([.16, .02, .015], .7 + .3 * pulse), am) : inRoom ? [.06, .05, .04] : mix3([.055, .062, .09], [.08, .03, .04], am * .5);
      const fogC = st.area === 2 ? [.008, .008, .01] : inside ? mix3([.006, .006, .007], [.06, .004, .003], am) : [.03, .036, .055];
      const fogD = st.area === 2 ? .05 : inside ? .055 : .018;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(fogC[0], fogC[1], fogC[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      const common = pg => {
        gl.useProgram(pg.p);
        gl.uniformMatrix4fv(pg.u.uVP, false, VP); gl.uniform3fv(pg.u.uCam, camPos);
        gl.uniform3fv(pg.u.uAmb, amb); gl.uniform3fv(pg.u.uFogCol, fogC); gl.uniform1f(pg.u.uFogDen, fogD);
        gl.uniform3fv(pg.u.uLPos, Lpos); gl.uniform3fv(pg.u.uLCol, Lcol); gl.uniform1fv(pg.u.uLRange, Lrange); gl.uniform1i(pg.u.uLCount, Ln);
        gl.uniform1i(pg.u.uMode, 0); gl.uniform1f(pg.u.uAlpha, 1); gl.uniform1f(pg.u.uSkinNoise, 0); gl.uniform3f(pg.u.uEmissive, 0, 0, 0);
        gl.uniform1f(pg.u.uTime, t); gl.uniform3f(pg.u.uSpotCol, 0, 0, 0);
      };
      common(progW); gl.uniformMatrix4fv(progW.u.uModel, false, I); gl.uniform1i(progW.u.uFlip, 1); gl.uniform1i(progW.u.uTex, 0); gl.activeTexture(gl.TEXTURE0);
      const draw = (m, color, o = {}) => {
        gl.uniform3fv(progW.u.uColor, color);
        gl.uniform1i(progW.u.uUseTex, o.tex ? 1 : 0); if (o.tex) gl.bindTexture(gl.TEXTURE_2D, o.tex);
        gl.uniform1f(progW.u.uSpec, o.spec || 0); gl.uniform1f(progW.u.uShine, o.shine || 24); gl.uniform3fv(progW.u.uEmissive, o.em || [0, 0, 0]);
        if (o.mode) gl.uniform1i(progW.u.uMode, o.mode);
        if (o.model) gl.uniformMatrix4fv(progW.u.uModel, false, o.model);
        gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        if (o.model) gl.uniformMatrix4fv(progW.u.uModel, false, I);
        if (o.mode) gl.uniform1i(progW.u.uMode, 0);
      };
      const red = [2.4 * am * (.4 + .6 * pulse), .1 * am, .05 * am];
      const cyaw = yaw, cpitch = pitch, right = [Math.cos(yaw), 0, Math.sin(yaw)], up = [-Math.sin(yaw) * Math.sin(pitch) * 1, Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
      const hand = [eye[0] + fwd[0] * .55 + right[0] * .3 - up[0] * .1, eye[1] + fwd[1] * .55 - up[1] * .1, eye[2] + fwd[2] * .55 + right[2] * .3 - up[2] * .1];
      const ropeC = () => ropeM ? ropeM.color : [.61, .52, .23];
      const ropeSeg = (a, b, r) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-4; draw(cylM, ropeC(), { spec: .15, shine: 10, model: M4.trs(a, Q.mul(Q.aa(0, 1, 0, Math.atan2(dx, dz)), Q.aa(1, 0, 0, Math.asin(clamp(-dy / L, -1, 1)))), [r, r, L]) }); };
      const knotAt = (p, sz, q) => { if (ropeM) draw(ropeM, ropeC(), { spec: .15, shine: 10, model: M4.mul(M4.trs(p, q, [sz, sz, sz]), M4.trs([-ropeM.c[0], -ropeM.c[1], -ropeM.c[2]], [0, 0, 0, 1], [1, 1, 1])) }); };
      const flatQ = (yawA, tip) => Q.mul(Q.aa(0, 1, 0, yawA), Q.aa(1, 0, 0, tip));
      if (st.area === 1) {
        draw(M.hfloor, [.8, .78, .74], { tex: texFloor, spec: .3, shine: 36 });
        draw(M.hwall, [.85, .85, .85], { tex: texWall, spec: .05 });
        draw(M.hceil, [.35, .34, .33], { tex: texFloor });
        draw(M.pit, [.18, .17, .16], { tex: texFloor });
        draw(M.metal, [.2, .2, .21], { spec: .9, shine: 48 });
        draw(M.dark, [.05, .05, .05], { spec: .3, shine: 30 });
        draw(M.wood, [.62, .43, .24], { tex: texFloor });
        draw(M.cloth, [.3, .27, .22]);
        draw(M.rust, [.32, .17, .09], { tex: texFloor, spec: .3, shine: 26 });
        draw(M.drum, [.25, .28, .3], { spec: .5, shine: 30 });
        draw(M.roof, [.42, .42, .42], { tex: texFloor, spec: .1 });
        draw(M.parapet, [.5, .48, .45], { tex: texFloor });
        draw(M.facade, [1, 1, 1], { tex: texWin, mode: 5 });
        draw(M.room, [.62, .55, .45], { tex: texWall });
        draw(M.roomfloor, [.55, .38, .22], { tex: texFloor, spec: .3, shine: 30 });
        draw(M.bulbs, [0, 0, 0], { em: mix3(sc3([1.8, 1.1, .5], flick * .5 + .5), [2.2, .12, .06], am) });
        draw(M.sodium, [0, 0, 0], { em: [2.2, 1.1, .35] });
        draw(M.warm, [0, 0, 0], { em: [2.2, 1.7, 1.0] });
        draw(M.beacon, [.25, .02, .02], { em: red });
        if (!st.frontBroken) {
          draw(M.rfront, [.62, .55, .45], { tex: texWall }); draw(M.rfmetal, [.2, .2, .21], { spec: .9, shine: 48 }); draw(M.rfwarm, [0, 0, 0], { em: [2.2, 1.7, 1.0] });
          draw(doorM, [.35, .22, .14], { tex: texFloor, spec: .2, model: M4.trs([-.6, RB_Y, ROOM.z1 - .05], Q.aa(0, 1, 0, st.doorAng), [1, 1, 1]) });
        } else {
          const dq = doorBody.rest ? flatQ(doorBody.r[1], -Math.PI / 2) : Q.euler(doorBody.r[0], doorBody.r[1], doorBody.r[2]);
          draw(doorM, [.35, .22, .14], { tex: texFloor, spec: .2, model: M4.mul(M4.trs(doorBody.p, dq, [1, 1, 1]), M4.trs([-.6, -1.1, 0], [0, 0, 0, 1], [1, 1, 1])) });
          for (const c of frontBits) draw(cubeM, [.62, .55, .45], { tex: texWall, model: M4.trs(c.p, Q.euler(c.r[0], c.r[1], c.r[2]), c.s) });
        }
        if (!st.glassBroken) draw(M.winbars, [.3, .22, .15], { tex: texFloor });
        else if (t - st.jumpT < 2.5) for (const sd of shards) draw(cubeM, [.35, .42, .46], { spec: 1.6, shine: 90, model: M4.trs(sd.p, Q.euler(sd.r[0], sd.r[1], sd.r[2]), [.16, .12, .01]) });
        for (const c of chunks) draw(cubeM, [.66, .63, .58], { tex: texFloor, model: M4.trs(c.p, Q.euler(c.r[0], c.r[1], c.r[2]), [.8, HH / 3, .26]) });
      } else {
        draw(M2.floor, [.6, .58, .56], { tex: texFloor, spec: .35, shine: 40 });
        draw(M2.wall, [.72, .76, .78], { tex: texWall, spec: .05 });
        draw(M2.ceil, [.32, .32, .33], { tex: texFloor });
        draw(M2.trim, [.07, .07, .08], { spec: .3 });
        draw(M2.metal, [.22, .23, .24], { spec: .9, shine: 48 });
        draw(M2.lamp, [.06, .06, .06], { spec: .3 });
        const qf = t - a2.quakeT < 2.4 ? (Math.sin(t * 37) > .3 ? 1 : .25) : 1;
        draw(M2.tube, [0, 0, 0], { em: sc3(mix3([1.9, 2.0, 2.2], [2.2, .12, .06], am * .75), flick * .3 + .7 * qf) });
        draw(M2.roomwall, [.58, .52, .44], { tex: texWall, spec: .05 });
        draw(M2.syrwall, [.55, .36, .38], { tex: texWall, spec: .05 });
        draw(M2.nroom, [.16, .13, .18], { tex: texFloor });
        draw(M2.crate, [.6, .42, .24], { tex: texFloor, spec: .1 });
        draw(M2.red, [0, 0, 0], { em: [2.4 * (.35 + .65 * a2.shutR), .1, .06] });
        draw(M2.signL, [1, 1, 1], { tex: texSignL }); draw(M2.signR, [1, 1, 1], { tex: texSignR });
        const doorQ = Q.aa(0, 1, 0, Math.PI / 2), dcol = [.5, .32, .2];
        draw(midDoorM, dcol, { tex: texFloor, spec: .25, model: M4.trs([-H2.hw, 0, H2.zD1], doorQ, [1, 1, 1]) });
        if (rdoor.state === 'shut') { const k = t - a2.doorShakeT < .4 ? Math.sin(t * 70) * .012 : 0; draw(midDoorM, dcol, { tex: texFloor, spec: .25, model: M4.trs([H2.hw + k, 0, H2.zD1], Q.mul(doorQ, Q.aa(0, 1, 0, k * 2)), [1, 1, 1]) }); }
        else { const q = rdoor.state === 'down' ? flatQ(rdoor.r[1], Math.PI / 2) : Q.euler(rdoor.r[0], rdoor.r[1], rdoor.r[2]); draw(midDoorM, dcol, { tex: texFloor, spec: .25, model: M4.mul(M4.trs(rdoor.p, q, [1, 1, 1]), M4.trs([-.6, -1.15, 0], [0, 0, 0, 1], [1, 1, 1])) }); }
        draw(shutLM, [.85, .85, .85], { tex: texShut, spec: .6, shine: 30, model: M4.trs([SHUT_L.x - .1, a2.shutL * SHUT_L.h * .96, (SHUT_L.z0 + SHUT_L.z1) / 2], [0, 0, 0, 1], [1, 1, 1]) });
        draw(shutRM, [.85, .85, .85], { tex: texShut, spec: .6, shine: 30, model: M4.trs([SHUT_R.x + .1, a2.shutR * SHUT_R.h * .96, (SHUT_R.z0 + SHUT_R.z1) / 2], [0, 0, 0, 1], [1, 1, 1]) });
        for (const [B, on, buzz] of [[BTN_L, a2.btnL >= 0, false], [BTN_R, a2.btnR >= 0, t - a2.buzzT < .5]]) {
          const em = on ? [.1, 1.4, .35] : buzz ? [Math.sin(t * 40) > 0 ? 2.2 : .3, .1, .05] : [1.5, .07, .04];
          draw(cubeM, [.2, .03, .02], { em, spec: 1, shine: 60, model: M4.trs([B[0], B[1], B[2] + .1 - (on ? .035 : 0)], [0, 0, 0, 1], [.15, .15, .08]) });
        }
        // the rope
        const hookQ = Q.aa(0, 1, 0, Math.PI / 2);
        if (a2.rope === 'crate') knotAt([-14.9, CRATE[4] + .06, ZC], .12, flatQ(.6, -Math.PI / 2));
        else if (a2.rope === 'tied1') { const K = a2.tie1 === 'L' ? KNOT_L : KNOT_R; knotAt(K, .045, hookQ); ropeSeg(K, hand, .018); }
        else if (a2.rope === 'tied') { const mid = [0, KNOT_L[1] - .05, KNOT_L[2]]; ropeSeg(KNOT_L, mid, .018); ropeSeg(mid, KNOT_R, .018); knotAt(KNOT_L, .045, hookQ); knotAt(KNOT_R, .045, hookQ); }
        else if (a2.rope === 'snapped') { const b1 = [-.9, .03, -6.0], b2 = [.5, .03, -5.4], b3 = [1.1, .03, -4.9]; ropeSeg(KNOT_L, b1, .018); ropeSeg(b1, b2, .018); ropeSeg(b2, b3, .018); knotAt(KNOT_L, .045, hookQ); }
      }

      // characters
      common(progS); gl.uniform1i(progS.u.uFlip, 1);
      if (st.area === 1) {
        if (bb.state !== 'hidden') {
          banban.setPose(banbanPose(bb.run, bb.ph, bb.roar, t));
          let lift = Infinity; B_FEET.forEach((n, i) => { lift = Math.min(lift, banban.jointPos(n)[1] - B_REST[i]); });
          const model = M4.trs([bb.x, bb.y + (B_FOOT - lift) * B_SC, bb.z], Q.mul(Q.aa(0, 1, 0, bb.yaw), Q.aa(1, 0, 0, (bb.lean || 0) * .75)), [B_SC, B_SC, B_SC]);
          banban.draw(progS, model, { spec: { material_1: [.45, 30], material_0: [1.2, 60] }, emissive: { material_0: [.25, .25, .25] } });
        }
        if (td.state !== 'gone' && ensureToad() && (st.p.z < -38 || st.phase === 'leap')) {
          const tk = envAt(A.hand, envHand);
          let d;
          if (td.state === 'wait') {
            d = walkPose(0, 0, 0, -.08, tk, t);
            d.RightArm = Q.mul(Q.aa(0, 0, 1, -70 * D), Q.aa(1, 0, 0, 15 * D));
            d.RightForeArm = Q.aa(0, 0, 1, -(55 + 35 * Math.sin(t * 7)) * D);
            d.LeftArm = Q.mul(Q.aa(0, 0, 1, 25 * D), Q.aa(1, 0, 0, 70 * D));
          } else if (td.state === 'catch') {
            const lift = st.phase === 'pull' ? smooth(0, 1.2, t - st.pullT) : 0;
            d = sitPose({ t, hip: (75 - 50 * lift) * D, knee: (110 - 80 * lift) * D, hunch: (55 - 35 * lift) * D, armDown: (20 + 30 * lift) * D, armFwd: 80 * D, elbow: (8 + 40 * lift) * D, headPitch: 30 * D });
          } else if (td.state === 'run' || td.state === 'scared') d = walkPose(td.run, td.ph, 0, 0, 0, t);
          else {
            d = walkPose(0, 0, 0, 0, 0, t);
            if (td.state === 'close') { const k = smooth(st.closeT, st.closeT + .5, t); d.RightArm = Q.mul(Q.aa(0, 0, 1, -75 * D * k), Q.aa(1, 0, 0, (74 - 50 * k) * D)); }
          }
          toad.setPose(d);
          const lf = Math.min(toad.jointPos('LeftToe_End')[1], toad.jointPos('LeftFoot')[1], toad.jointPos('RightToe_End')[1], toad.jointPos('RightFoot')[1]) - toad.restFeet;
          const model = M4.trs([td.x, td.y + (.03 - lf) * T_SC, td.z], Q.aa(0, 1, 0, td.yaw), [T_SC, T_SC, T_SC]);
          toad.draw(progS, model, { spec: { Eyes: [1.4, 60], Pupils: [1.5, 80], Teeth: [.8, 40], Star: [1.2, 40] }, emissive: { Star: [.12, .1, .02] } });
        }
      } else {
        if (syr && sy.state !== 'hidden') syr.draw(progS, sy.M, { spec: { Body: [.55, 36], Eyes: [1.4, 60], Pupils: [1.6, 80], Scissors: [1.3, 60], Syringe: [1.1, 50], Drill: [1.3, 60], Claw: [1.3, 60] } });
        if (nrig) for (const n of nos) {
          if (n.state === 'hidden' || n.state === 'gone' || n.state === 'wait') continue;
          nrig.setAnim([[n.state === 'flee' ? 'walk' : n.state === 'attached' ? 'eyes' : 'idle', n.animT, 1]]);
          nrig.draw(progS, M4.mul(M4.trs([n.x, n.y, n.z], Q.mul(Q.aa(0, 1, 0, n.yaw), Q.aa(1, 0, 0, n.rx)), [N_SC, N_SC, N_SC]), M4.trs(N_OFF, [0, 0, 0, 1], [1, 1, 1])), { spec: { material_0: [.6, 30] }, tint: { material_0: [1.7, 1.65, 1.8] }, emissive: { material_0: [.05, .04, .07] } });
        }
      }
      gl.useProgram(progW.p);

      // glows + dust (additive)
      gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1i(progW.u.uUseTex, 0);
      if (st.area === 1 && !st.glassBroken) {   // the window glass: faint reflections only
        gl.uniform1i(progW.u.uMode, 0); gl.uniform1f(progW.u.uSpec, 1.4); gl.uniform1f(progW.u.uShine, 90); gl.uniform3fv(progW.u.uEmissive, [0, 0, 0]); gl.uniform3fv(progW.u.uColor, [.05, .06, .08]); gl.uniform1f(progW.u.uAlpha, 1);
        gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs([0, (WIN.y0 + WIN.y1) / 2, ROOM.z0 + .01], [0, 0, 0, 1], [WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, 1]));
        gl.bindVertexArray(sprite.vao); gl.drawElements(gl.TRIANGLES, sprite.count, sprite.type, 0);
      }
      gl.uniform1i(progW.u.uMode, 2); gl.bindVertexArray(sprite.vao);
      const glow = (p, size, c, a) => {
        if (a <= .01) return; const dx = camPos[0] - p[0], dz = camPos[2] - p[2]; if (dx * dx + dz * dz > 14400) return;
        gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs(p, Q.aa(0, 1, 0, Math.atan2(dx, dz)), [size, size, size]));
        gl.uniform3fv(progW.u.uColor, c); gl.uniform1f(progW.u.uAlpha, a); gl.drawElements(gl.TRIANGLES, sprite.count, sprite.type, 0);
      };
      if (st.area === 1) {
        HALL_LAMPS.forEach(([z, s], i) => glow([s * (HW - .15), 2.58, z], .8, mix3([1, .6, .3], [1, .06, .03], am), (i === 3 ? flick : 1) * .7));
        [-12, -22].forEach(z => glow([0, HH - .25, z], 1.0, [1, .06, .03], am * pulse));
        ROOF_LAMPS.forEach(([x, y, z]) => glow([x - Math.sign(x) * .88, y + 2.9, z], 2.2, [1, .55, .2], .85));
        glow([0, 9.7, -26.3], 4, [1, .05, .03], am * Math.abs(Math.sin(t * 3)));
        if (!st.frontBroken) glow([0, RB_Y + 2.36, ROOM.z1 + .12], .8, [1, .8, .5], .8);
        glow([-2.5, STREET + 5.2, -75], 4, [1, .6, .25], .9); glow([3, STREET + 5.2, -77.5], 4, [1, .6, .25], .9);
        if (st.breakT >= 0) { const k = t - st.breakT; for (let i = 0; i < 7; i++) { const kk = k - i * .07; if (kk < 0 || kk > 3) continue; glow([Math.sin(i * 2.3) * .8, .6 + kk * .6 + i * .15, Z_HBACK - .5 - kk * (1.6 + i * .3)], 1.5 + kk * 1.4, [.55, .5, .45], .32 * Math.exp(-kk * 1.2)); } }
      } else {
        const qf = t - a2.quakeT < 2.4 ? (Math.sin(t * 37) > .3 ? 1 : .25) : 1;
        HALL2_LAMPS.forEach(([x, z], i) => glow([x, H2.h - .15, z], 1.0, mix3([.75, .85, 1], [1, .06, .03], am * .75), (i === 2 ? flick : 1) * .45 * qf));
        glow([-14.5, ROPE_ROOM.h - .15, ZC], 1.0, [1, .7, .4], .5 * qf);
        glow([15, SYR_ROOM.h - .2, -20], 1.4, [1, .05, .03], .5 + .5 * a2.shutR);
        glow([BTN_L[0], BTN_L[1], BTN_L[2] + .2], .55, a2.btnL >= 0 ? [.1, 1, .3] : [1, .05, .03], .8);
        glow([BTN_R[0], BTN_R[1], BTN_R[2] + .2], .55, a2.btnR >= 0 ? [.1, 1, .3] : [1, .05, .03], .8);
        for (const f of a2.fires) { const k = t - f.t0; if (k < 0) continue; const e = Math.max(0, 1 - k / f.life); glow(f.p, f.size * (.7 + k * 1.5), [1, .3 + .4 * e, .08 + .2 * e], 1.3 * e); glow(f.p, f.size * .55, [1, .85, .55], 1.6 * e * e); }
      }
      gl.uniform1i(progW.u.uMode, 0); gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
      // the rope in your hand, drawn over everything
      if (st.area === 2 && (a2.rope === 'hand' || a2.rope === 'tied1') && (st.phase === 'explore2' || st.phase === 'chase2')) {
        gl.clear(gl.DEPTH_BUFFER_BIT); common(progW); gl.uniformMatrix4fv(progW.u.uModel, false, I); gl.uniform1i(progW.u.uFlip, 1);
        knotAt(hand, .055, Q.mul(Q.aa(0, 1, 0, Math.PI - cyaw), Q.mul(Q.aa(1, 0, 0, cpitch), Q.euler(.5, .3, .9))));
      }
    }

    let t0 = performance.now();
    function loop(now) { if (!alive) return; frame((now - t0) / 1000); raf = requestAnimationFrame(loop); }
    // start: eyes open in the hallway
    hud.lids.classList.add('on');
    if (opts.debugSetup) opts.debugSetup(st, { beginExplore, startFreeze, breakWall, startLeap, startClose, caughtByBanban, respawn, bb, td, ensureToad, chunks,
      breakFront, jumpOut, enterArea2, beginExplore2, onAct, releaseSyringeon, springTrap, syrSaved, pullNaughty, caughtBySyr, ensureArea2Models, a2, sy, nos, rdoor, later });
    if (opts.debugTime !== undefined) { const T0 = opts.debugFrom || 0; st.t = T0; for (let t = T0; t <= opts.debugTime; t += 1 / 30) frame(t, t + 1 / 30 <= opts.debugTime); }
    else { t0 = performance.now() - (opts.debugFrom || 0) * 1000; st.t = opts.debugFrom || 0; raf = requestAnimationFrame(loop); }

    return {
      stop() {
        alive = false; cancelAnimationFrame(raf); sfx.stop();
        hud.zone.removeEventListener('pointerdown', onZoneDown); canvas.removeEventListener('pointerdown', onCanvasDown);
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
        for (const el of [A.croak, A.hand, A.seneng]) if (el) { try { el.pause(); el.onended = null; } catch (e) {} }
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
        hud.root.remove();
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      },
      state: st, bb, td, a2, sy, nos, _dbg: { enterArea2, breakFront, startClose, jumpOut, releaseSyringeon, springTrap, ensureArea2Models }, _frame: (t, nd) => frame(t, nd)
    };
  }

  window.Chapter2 = { start: startC2, _internals: { makeRig, M4, Q, banbanPose, walkPose, sitPose, compile, VS_SKIN, VS_WORLD, FS, makeStatic } };
})();
