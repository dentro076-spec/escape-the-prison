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
  // on a computer: click the game to lock the mouse and look around by moving it; Esc lets go
  function makeMouseLock(canvas, hud, onLook) {
    const tip = document.createElement('div'); tip.className = 'c1-lock'; tip.textContent = 'Click to lock the mouse \u00b7 Esc to unlock';
    const cross = document.createElement('div'); cross.className = 'c1-cross';
    hud.root.appendChild(tip); hud.root.appendChild(cross);
    const fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
    if (!fine || !canvas.requestPointerLock) return { update() {}, stop() { tip.remove(); cross.remove(); } };
    const locked = () => document.pointerLockElement === canvas;
    const canLock = () => !hud.dead.classList.contains('show') && !hud.end.classList.contains('show');   // buttons to press: let the mouse go
    const lock = () => {
      const plain = () => { try { const q = canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) {} };
      try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); }
      catch (e) { plain(); }
    };
    const onClick = e => { if (e.pointerType && e.pointerType !== 'mouse') return; if (!locked() && canLock()) lock(); };
    const onMove = e => { if (locked()) onLook(e.movementX || 0, e.movementY || 0); };
    canvas.addEventListener('click', onClick); hud.zone.addEventListener('click', onClick); document.addEventListener('mousemove', onMove);
    return {
      update() {
        const L = locked(), ok = canLock();
        if (L && !ok) { try { document.exitPointerLock(); } catch (e) {} }
        tip.classList.toggle('show', !L && ok); cross.classList.toggle('show', L);
      },
      stop() {
        canvas.removeEventListener('click', onClick); hud.zone.removeEventListener('click', onClick); document.removeEventListener('mousemove', onMove);
        if (locked()) { try { document.exitPointerLock(); } catch (e) {} }
        tip.remove(); cross.remove();
      }
    };
  }
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
  .c1-lock{position:absolute;left:50%;bottom:clamp(44px,8vh,66px);transform:translateX(-50%);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#e9dcc6;background:rgba(0,0,0,.45);padding:.5em 1em;border-radius:999px;opacity:0;transition:opacity .4s;white-space:nowrap;pointer-events:none}
  .c1-lock.show{opacity:.85}
  .c1-cross{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:rgba(255,245,230,.75);box-shadow:0 0 0 1.5px rgba(0,0,0,.45);opacity:0;transition:opacity .2s;pointer-events:none}
  .c1-cross.show{opacity:1}
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

  /* ================= multiplayer: other players drawn as little explorers with name tags ================= */
  function latheGeo(g, prof, seg, cx = 0, cy = 0, cz = 0) {
    const base = g.p.length / 3;
    for (let i = 0; i < prof.length; i++) {
      const [r, y] = prof[i], a0 = prof[Math.max(0, i - 1)], a1 = prof[Math.min(prof.length - 1, i + 1)];
      const dr = a1[0] - a0[0], dy = a1[1] - a0[1], nl = Math.hypot(dr, dy) || 1, nr = dy / nl, ny = -dr / nl;
      for (let s = 0; s <= seg; s++) { const a = s / seg * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a); g.v([cx + c * r, cy + y, cz + sn * r], [c * nr, ny, sn * nr], [s / seg, i / (prof.length - 1)]); }
    }
    for (let i = 0; i < prof.length - 1; i++) for (let s = 0; s < seg; s++) { const a = base + i * (seg + 1) + s, b = a + seg + 1; g.i.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const sphereProf = (r, n = 10) => { const p = []; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; p.push([Math.cos(a) * r + 1e-4, Math.sin(a) * r]); } return p; };
  const MP_COLORS = [[.31, .72, 1], [1, .42, .42], [.49, .85, .57], [.96, .82, .29], [.76, .65, 1], [1, .58, .26]];
  function makeMpAvatars(gl, container) {
    const mk = f => { const g = new Geo(); f(g); return meshFromGeo(gl, g); };
    const body = mk(g => latheGeo(g, [[.001, .55], [.2, .56], [.27, .66], [.28, .95], [.25, 1.18], [.14, 1.28], [.001, 1.3]], 14));
    const head = mk(g => latheGeo(g, sphereProf(.21, 10), 14, 0, 1.5, 0));
    const cap = mk(g => { latheGeo(g, [[.001, 1.73], [.12, 1.72], [.2, 1.66], [.225, 1.56], [.23, 1.55]], 14); g.box(-.17, 1.55, .1, .17, 1.58, .36); });
    const eyes = mk(g => { latheGeo(g, sphereProf(.045, 6), 8, -.075, 1.53, .185); latheGeo(g, sphereProf(.045, 6), 8, .075, 1.53, .185); });
    const leg = mk(g => g.cyl(0, 0, -.58, 0, .085, .095, 10));     // hangs from the hip (local origin)
    const arm = mk(g => g.cyl(0, 0, -.5, 0, .06, .07, 8));         // hangs from the shoulder
    const layer = document.createElement('div'); layer.className = 'mp-tags';
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2';
    container.appendChild(layer);
    const tracks = new Map();
    function draw(prog, VP, t, dt, peers, area, cam) {
      const seen = new Set();
      for (const pr of peers || []) {
        if (pr.area !== area || pr.dead) continue;
        seen.add(pr.key);
        let k = tracks.get(pr.key);
        if (!k) { k = { x: pr.x, y: pr.y, z: pr.z, yw: pr.yw, ph: 0, sp: 0, tag: null }; tracks.set(pr.key, k); }
        const f = 1 - Math.exp(-dt * 12), ox = k.x, oz = k.z;
        k.x += (pr.x - k.x) * f; k.y += (pr.y - k.y) * f; k.z += (pr.z - k.z) * f;
        let dy = pr.yw - k.yw; dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; k.yw += dy * f;
        if (Math.hypot(pr.x - k.x, pr.z - k.z) > 8) { k.x = pr.x; k.y = pr.y; k.z = pr.z; }   // teleported (respawn)
        const speed = dt > 0 ? Math.hypot(k.x - ox, k.z - oz) / dt : 0; k.sp += (Math.min(speed, 6) - k.sp) * Math.min(1, dt * 6); k.ph += dt * k.sp * 2.2;
        const cr = pr.crouch ? 1 : 0, sy = cr ? .58 : 1, feet = k.y - (cr ? .85 : 1.6);
        if (cam && Math.hypot(k.x - cam[0], k.z - cam[2]) < .75) { if (k.tag) k.tag.style.display = 'none'; continue; }   // standing inside you (same spawn point)
        const col = MP_COLORS[pr.color % MP_COLORS.length], swing = Math.sin(k.ph) * Math.min(1, k.sp / 2.5) * .7, bob = Math.abs(Math.sin(k.ph)) * .04 * Math.min(1, k.sp / 2.5);
        const root = M4.trs([k.x, feet + bob, k.z], Q.aa(0, 1, 0, Math.PI - k.yw), [1, sy, 1]);
        const part = (m, color, local, o = {}) => {
          gl.uniformMatrix4fv(prog.u.uModel, false, local ? M4.mul(root, local) : root);
          gl.uniform3fv(prog.u.uColor, color); gl.uniform1i(prog.u.uUseTex, 0); gl.uniform1f(prog.u.uSpec, o.spec || .3); gl.uniform1f(prog.u.uShine, o.shine || 30); gl.uniform3fv(prog.u.uEmissive, o.em || [0, 0, 0]);
          gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        };
        const glowC = [col[0] * .12, col[1] * .12, col[2] * .12];   // a faint glow so friends are findable in the dark
        part(body, col, null, { em: glowC });
        part(head, [.98, .82, .68], null, { em: [.05, .04, .03] });
        part(cap, col, null, { spec: .5, em: glowC });
        part(eyes, [.02, .02, .02], null, { spec: 1.2, shine: 80 });
        for (const s of [-1, 1]) {
          part(leg, [.16, .17, .24], M4.trs([s * .11, .6, 0], Q.aa(1, 0, 0, s * swing * (cr ? .3 : 1)), [1, 1, 1]));
          part(arm, col, M4.trs([s * .31, 1.18, 0], Q.mul(Q.aa(1, 0, 0, -s * swing), Q.aa(0, 0, 1, s * .12)), [1, 1, 1]), { em: glowC });
        }
        // name tag
        if (!k.tag) { k.tag = document.createElement('div'); k.tag.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:700 13px/1 system-ui,sans-serif;letter-spacing:.06em;padding:4px 8px 3px;border-radius:999px;background:rgba(0,0,0,.55);white-space:nowrap;text-shadow:0 1px 0 #000'; layer.appendChild(k.tag); }
        if (k.tag.textContent !== pr.name) k.tag.textContent = pr.name;
        k.tag.style.color = 'rgb(' + col.map(c => Math.round(Math.min(1, c * 1.1) * 255)).join(',') + ')';
        const hp = [k.x, feet + (cr ? 1.25 : 2.0), k.z], c4 = [0, 1, 2, 3].map(r => VP[r] * hp[0] + VP[4 + r] * hp[1] + VP[8 + r] * hp[2] + VP[12 + r]);
        const W = layer.clientWidth, H = layer.clientHeight, dist = c4[3];
        if (c4[3] > .1 && dist < 45) {
          const sx = (c4[0] / c4[3] * .5 + .5) * W, sy2 = (1 - (c4[1] / c4[3] * .5 + .5)) * H;
          k.tag.style.display = ''; k.tag.style.transform = `translate(${sx.toFixed(1)}px,${sy2.toFixed(1)}px) translate(-50%,-100%)`; k.tag.style.opacity = String(Math.min(1, (45 - dist) / 10));
        } else k.tag.style.display = 'none';
      }
      gl.uniform3fv(prog.u.uEmissive, [0, 0, 0]); gl.uniformMatrix4fv(prog.u.uModel, false, M4.ident()); gl.bindVertexArray(null);
      for (const [key, k] of tracks) if (!seen.has(key)) { if (k.tag) k.tag.remove(); tracks.delete(key); }
    }
    return { draw, dispose() { layer.remove(); tracks.clear(); } };
  }

  /* ================= co-op: the leader's game runs the story and the monsters; friends see the same world =================
     cfg (from each chapter):
       R            objects to share {name: obj or array}
       skip         {name: [keys]} extra keys that stay local
       zone()       a number that changes when the leader moves to a new area (friends get teleported along)
       ctl()        (leader) does the player have control right now (false = cutscene)
       dangerAt(feet, g)  (leader) would a monster catch a friend standing here?
       onGuest(g, dt)     (leader) per-friend upkeep
       doAct(kind, g)     (leader) run a friend's button press
       onShared(prev, cur)  (friend) spawn local-only debris when a shared flag flips
       afterTeleport(hp)  (friend) e.g. copy crouching
       showAct(kind)      (friend) hide the action button during cutscenes
       ownCam(phase)      (friend) story scenes where you keep your own camera (e.g. looking around during a ride)
       guestFree(phase)   (friend) leader-only moments where friends keep playing (e.g. the leader's own short drop)
       music {name: el | {el, loop}}  */
  const COOP_SKIP = ['p', 'camYaw', 'camPitch', 'eye', 'dragYaw', 'dragPitch', 'timers', 'toastUntil', 'toastKey', 't', 'act', 'crouch', 'crouchK',
    'hints', 'saidRoom', 'lastPZ', 'pipKey', 'turnFrom', 'pitchFrom', 'caughtT', 'caughtBy', 'camUp', 'hopFrom', 'jumpFrom', 'leapFrom', 'rideAudio', 'wakeT', 'punchT', 'held'];
  const COOP_DEAD = { caught: 1, dead: 1, caught2: 1, fell: 1 };
  const COOP_FX_SKIP = { pstep: 1, jump: 1, land: 1, siren: 1, setHum: 1, engine: 1, water: 1, stop: 1, splash: 1, ring: 1 };
  function coopPlain(v, d = 0) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return d > 5 ? null : v.map(x => { const y = coopPlain(x, d + 1); return y === undefined ? null : y; });
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const o = {};
      for (const k in v) { const x = v[k]; if (x === undefined || typeof x === 'function') continue; if (x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype) continue; const y = coopPlain(x, d + 1); if (y !== undefined) o[k] = y; }
      return o;
    }
    return undefined;
  }
  const COOP_ANG = /yaw|Yaw/;
  function coopLerp(a, b, k, key) {
    if (typeof b === 'number' && typeof a === 'number') {
      if (Number.isInteger(a) && Number.isInteger(b)) return b;   // counters (hits, charge) don't blend
      if (COOP_ANG.test(key || '')) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
      return Math.abs(b - a) > 25 ? b : a + (b - a) * k;   // big jumps (teleports, timers) are not smoothed
    }
    if (Array.isArray(b)) return Array.isArray(a) && a.length === b.length ? b.map((x, i) => coopLerp(a[i], x, k, key)) : b;
    if (b && typeof b === 'object') { if (!a || typeof a !== 'object' || Array.isArray(a)) return b; const o = {}; for (const kk in b) o[kk] = coopLerp(a[kk], b[kk], k, kk); return o; }
    return b;
  }
  const coopIsObj = x => x && typeof x === 'object' && !Array.isArray(x);
  function coopAssign(target, src, skip) {
    for (const k in src) {
      if (skip && skip[k]) continue;
      const v = src[k], cur = target[k];
      if (cur && typeof cur === 'object' && !Array.isArray(cur) && Object.getPrototypeOf(cur) !== Object.prototype) continue;   // live objects stay local
      if (coopIsObj(v) && coopIsObj(cur)) coopAssign(cur, v, null);
      else if (Array.isArray(v) && Array.isArray(cur) && cur.length === v.length && v.every(coopIsObj) && cur.every(coopIsObj)) v.forEach((x, i) => coopAssign(cur[i], x, null));
      else if (Array.isArray(v)) { if (Array.isArray(cur)) { cur.length = 0; for (const x of v) cur.push(coopIsObj(x) ? Object.assign({}, x) : Array.isArray(x) ? x.slice() : x); } else target[k] = v.slice(); }
      else if (coopIsObj(v)) target[k] = JSON.parse(JSON.stringify(v));
      else target[k] = v;
    }
  }
  function makeCoop(opts, st, hud, sfx, cfg) {
    const mp = opts.mp;
    if (!mp || !mp.coop) return null;
    const guest = mp.isGuest();
    const SKIP = {};
    for (const n in cfg.R) { const s = {}; if (n === 'st') for (const k of COOP_SKIP) s[k] = 1; for (const k of ((cfg.skip || {})[n] || [])) s[k] = 1; SKIP[n] = s; }
    const music = {};
    for (const n in (cfg.music || {})) { const m = cfg.music[n]; if (m) music[n] = m.el ? m : { el: m, loop: true }; }
    // ---- leader: note one-shot sounds so friends hear them too ----
    const fxLog = []; let fxSeq = 0;
    if (!guest) for (const k in sfx) {
      if (typeof sfx[k] !== 'function' || COOP_FX_SKIP[k]) continue;
      const f = sfx[k];
      sfx[k] = (...a) => { fxLog.push([++fxSeq, k, a.map(x => typeof x === 'number' ? Math.round(x * 100) / 100 : typeof x === 'string' ? x.slice(0, 80) : 0), st.t]); if (fxLog.length > 40) fxLog.shift(); return f(...a); };
    }
    let flashN = 0;
    try { new MutationObserver(() => { if (hud.flash.classList.contains('go')) flashN++; }).observe(hud.flash, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    const kills = {}, killT = {}, actSeen = {}, actQ = {}, actT = {}, gPrev = {}, onceT = {};
    let sq = 0, pubT = -9, gCache = null, gCacheT = -1;
    // ---- friend ----
    let buf = [], lastSq = -1, lastFx = -1, firstFrame = true, prevShared = null, gdead = false, killSeen = null, lastCut = false, lastZone = null,
      farT = 0, lastFlash = null, ended = false, waitT = 0, deadT = -9, offs = [];
    function pullFrames() {
      for (const f of mp.hostFrames()) {
        if (!f.w || f.w.sq <= lastSq) continue;
        lastSq = f.w.sq; buf.push(f); if (buf.length > 10) buf.shift();
        offs.push(f.w.T - f.at / 1000); if (offs.length > 10) offs.shift();
      }
    }
    // the leader's clock as seen here: newest snapshots arrive with the least delay, then wait a little to smooth between them
    const hostNow = () => buf.length ? performance.now() / 1000 + Math.max(...offs) - .14 : null;
    function sample(T) {
      let a = buf[0], b = buf[buf.length - 1];
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].w.T <= T && buf[i + 1].w.T >= T) { a = buf[i]; b = buf[i + 1]; break; }
      if (T >= b.w.T || a === b) return { w: b.w, R: b.w.R, cam: b.w.cam };
      if (T <= a.w.T) return { w: a.w, R: a.w.R, cam: a.w.cam };
      const k = clamp((T - a.w.T) / Math.max(1e-3, b.w.T - a.w.T), 0, 1);
      return { w: b.w, R: coopLerp(a.w.R, b.w.R, k), cam: coopLerp(a.w.cam, b.w.cam, k) };
    }
    const cutscene = w => !w.ctl && !COOP_DEAD[w.ph] && !(cfg.guestFree && cfg.guestFree(w.ph));   // the leader has no control (a story scene)
    const camCut = w => cutscene(w) && !(cfg.ownCam && cfg.ownCam(w.ph));             // ...and you watch it through their eyes
    const api = {
      guest, _s: null,
      // friend: the time to run this frame at (the leader's clock); null = nothing from the leader yet
      time(localT) {
        if (!guest) return localT;
        pullFrames();
        const T = hostNow();
        if (T === null) {
          const now = performance.now();
          if (now - waitT > 3000) { waitT = now; hud.toast.textContent = 'Joining your friend\u2026'; hud.toast.classList.add('show'); }
          return null;
        }
        return T;
      },
      // friend: copy the leader's world into this game before the frame runs
      apply(T) {
        const s = sample(T); if (!s) return;
        api._s = s;
        if (firstFrame) {
          firstFrame = false; hud.toast.classList.remove('show'); hud.lids.classList.remove('on');
          lastFx = (s.w.fx || []).reduce((m, e) => Math.max(m, e[0]), -1);
          killSeen = s.w.kl ? s.w.kl[mp.myKey()] || 0 : 0; lastFlash = s.w.hud ? s.w.hud.fl : 0;
        }
        for (const n in cfg.R) {
          const v = s.R[n]; if (v === undefined) continue;
          const sk = Object.assign({}, SKIP[n]);
          if (n === 'st' && COOP_DEAD[v.phase]) sk.phase = 1;   // the leader got caught: you keep playing
          const tgt = cfg.R[n];
          if (Array.isArray(tgt)) {
            if (tgt.length === v.length && v.every(coopIsObj) && tgt.every(coopIsObj)) v.forEach((x, i) => coopAssign(tgt[i], x, sk));
            else { tgt.length = 0; for (const x of v) tgt.push(coopIsObj(x) ? JSON.parse(JSON.stringify(x)) : x); }
          } else coopAssign(tgt, v, sk);
        }
        if (lastZone === null && cfg.zone) lastZone = cfg.zone();
        if (prevShared && cfg.onShared) try { cfg.onShared(prevShared, s.R); } catch (e) { console.error(e); }
        prevShared = s.R;
        if (COOP_DEAD[s.w.ph]) deadT = T;
        if (api._first === undefined) { api._first = 1; if (s.w.hp) api.teleport(s.w.hp); }
      },
      // after the frame's own camera: watch through the leader's eyes in cutscenes; follow them into new areas
      camera(t, dt) {
        if (!guest || !api._s) return;
        const s = api._s, w = s.w, p = st.p, cut = cutscene(w);
        if (camCut(w) && s.cam) { st.eye = s.cam.e.slice(); st.camYaw = s.cam.y; st.camPitch = s.cam.p; if ('camUp' in st) st.camUp = s.cam.u || null; }
        const zone = cfg.zone ? cfg.zone() : 0;
        const far = w.hp ? Math.hypot(p.x - w.hp[0], p.z - w.hp[2]) : 0;
        farT = far > 30 && !cut ? farT + dt : 0;
        if (!cut && lastCut) { p.yaw = st.camYaw; p.pitch = clamp(st.camPitch, -1.2, 1.2); }
        if (!cut && w.hp && !gdead && ((lastCut && far > 9) || (lastZone !== null && zone !== lastZone) || farT > 4)) { api.teleport(w.hp); farT = 0; }
        lastCut = cut; if (!cut) lastZone = zone;
      },
      teleport(hp) {
        const p = st.p;
        p.x = hp[0]; p.z = hp[2]; if ('y' in p) { p.y = hp[1]; p.vy = 0; } p.yaw = hp[3] || 0; p.pitch = 0;
        if (cfg.afterTeleport) cfg.afterTeleport(hp);
      },
      // friend: may you move right now?
      blocked() { if (!guest) return false; const s = api._s; return gdead || !s || cutscene(s.w); },
      // after the frame: the leader publishes; friends play the leader's sounds and music and copy the screen overlays
      post(t, dt) {
        if (!guest) return api.lead(t, dt);
        const s = api._s; if (!s) return;
        const w = s.w;
        for (const e of (w.fx || [])) if (e[0] > lastFx) { lastFx = e[0]; const f = sfx[e[1]]; if (typeof f === 'function') try { f(...e[2]); } catch (err) {} }
        for (const n in (w.mu || {})) {
          const m = music[n]; if (!m) continue; const el = m.el, [on, pos] = w.mu[n];
          try {
            if (on && el.paused) {
              el.loop = !!m.loop; el.muted = !(opts.musicOn ? opts.musicOn() : true); el.volume = opts.musicVol ? opts.musicVol() : 1;
              if (Math.abs(el.currentTime - pos) > .8) el.currentTime = pos;
              const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
            } else if (!on && !el.paused) el.pause();
          } catch (e) {}
        }
        const h = w.hud || {};
        if (hud.obj.textContent !== (h.o || '')) hud.obj.textContent = h.o || '';
        hud.obj.classList.toggle('show', !!h.o); hud.obj.classList.toggle('alarm', !!h.oa);
        if (h.ts) { if (hud.toast.textContent !== h.ts) hud.toast.textContent = h.ts; hud.toast.classList.add('show'); }
        else if (!st.toastUntil) hud.toast.classList.remove('show');
        hud.red.classList.toggle('on', !!h.red);
        if (!gdead) hud.black.classList.toggle('on', !!h.bl && t - deadT > .7);
        if (h.fl !== lastFlash) { lastFlash = h.fl; hud.flash.classList.remove('go'); void hud.flash.offsetWidth; hud.flash.classList.add('go'); }
        const ctl = !gdead && !cutscene(w);
        hud.zone.classList.toggle('on', ctl);
        hud.jump.classList.toggle('show', ctl && !!h.jp); if (!ctl) hud.jump.classList.remove('big');
        if (hud.crouch) hud.crouch.classList.toggle('show', ctl && !!h.cr);
        if (!ctl && cfg.showAct) cfg.showAct(null);
        if (h.end && !ended) { ended = true; hud.end.classList.add('show'); opts.onComplete && opts.onComplete(); }
        // did a monster get you?
        const kn = w.kl ? w.kl[mp.myKey()] || 0 : 0;
        if (killSeen !== null && kn > killSeen) { killSeen = kn; if (!gdead) api.die(); }
      },
      die() {
        gdead = true; sfx.scream(); hud.black.classList.remove('slow'); hud.black.classList.add('on'); if (cfg.showAct) cfg.showAct(null);
        setTimeout(() => { if (gdead) hud.dead.classList.add('show'); }, 700);
      },
      dead: () => gdead,
      respawn() {
        if (!gdead) return;
        gdead = false; hud.dead.classList.remove('show');
        const w = api._s && api._s.w; if (w && w.hp) api.teleport(w.hp);
        setTimeout(() => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); setTimeout(() => hud.black.classList.remove('slow'), 900); }, 150);
      },
      // friend presses a button: the leader's game does it
      sendAct(kind) { if (kind) mp.sendAct(kind); },
      // friend walked into a story trigger: tell the leader (not more than once every 2 s)
      once(kind) { const now = performance.now(); if (now - (onceT[kind] || -1e9) < 2000) return; onceT[kind] = now; mp.sendAct(kind); },
      cutscene() { return !!(guest && api._s && camCut(api._s.w)); },
      guests() {
        if (guest) return [];
        const now = performance.now(); if (!gCache || now - gCacheT > 8) { gCache = mp.guests(); gCacheT = now; }
        return gCache;
      },
      // leader
      lead(t, dt) {
        const gs = api.guests();
        for (const g of gs) {
          if (!isFinite(g.x) || !isFinite(g.z)) continue;
          const prev = gPrev[g.key]; g.mv = prev ? Math.hypot(g.x - prev.x, g.z - prev.z) / Math.max(1e-3, t - prev.t) : 0;
          if (!prev || t - prev.t > .25) gPrev[g.key] = { x: g.x, z: g.z, t };
          if (actSeen[g.key] === undefined) actSeen[g.key] = 0;
          const q = actQ[g.key] || (actQ[g.key] = []);
          if (g.ac) for (const [n, k] of g.ac) if (n > actSeen[g.key]) { actSeen[g.key] = n; q.push(k); }
          // one press at a time, a moment apart, like real taps (two can arrive in one network update)
          if (q.length && t - (actT[g.key] || -9) > .32) { actT[g.key] = t; const k = q.shift(); if (cfg.doAct) try { cfg.doAct(k, g); } catch (e) { console.error(e); } }
          if (cfg.onGuest) try { cfg.onGuest(g, dt); } catch (e) { console.error(e); }
          if (!g.dead && cfg.dangerAt && t - (killT[g.key] || -9) > 4) {
            let hit = false; try { hit = cfg.dangerAt([g.x, g.y - (g.crouch ? .85 : 1.62), g.z], g); } catch (e) {}
            if (hit) { killT[g.key] = t; kills[g.key] = (kills[g.key] || 0) + 1; pubT = -9; }
          }
        }
        if (!gs.length || t - pubT < .12) return;
        pubT = t;
        const R = {};
        for (const n in cfg.R) {
          const v = coopPlain(cfg.R[n]);
          if (v && !Array.isArray(v)) for (const k in SKIP[n]) delete v[k];
          R[n] = v;
        }
        const mu = {}; for (const n in music) { const el = music[n].el; mu[n] = [el.paused ? 0 : 1, Math.round((el.currentTime || 0) * 10) / 10]; }
        const has = (el, c) => !!(el && el.classList.contains(c));
        const w = {
          sq: ++sq, T: Math.round(st.t * 1000) / 1000, ph: st.phase, ctl: cfg.ctl() ? 1 : 0, R,
          cam: { e: st.eye.map(x => Math.round(x * 100) / 100), y: Math.round(st.camYaw * 1000) / 1000, p: Math.round(st.camPitch * 1000) / 1000, u: st.camUp ? st.camUp.map(x => Math.round(x * 1000) / 1000) : null },
          hp: [st.p.x, st.p.y || 0, st.p.z, st.p.yaw, st.crouch ? 1 : 0].map(x => Math.round(x * 100) / 100),
          fx: fxLog.filter(e => st.t - e[3] < 1.5 && st.t >= e[3] - .01).map(e => [e[0], e[1], e[2]]), mu, kl: kills,
          hud: {
            o: has(hud.obj, 'show') ? hud.obj.textContent : '', oa: has(hud.obj, 'alarm') ? 1 : 0, ts: has(hud.toast, 'show') ? hud.toast.textContent : '',
            red: has(hud.red, 'on') ? 1 : 0, bl: has(hud.black, 'on') ? 1 : 0, fl: flashN, end: has(hud.end, 'show') ? 1 : 0,
            jp: has(hud.jump, 'show') ? 1 : 0, jb: has(hud.jump, 'big') ? 1 : 0, cr: has(hud.crouch, 'show') ? 1 : 0
          }
        };
        mp.publish(w);
      }
    };
    return api;
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

  /* ================= chapter 3: the big room, the junkyard run, the laser, four sleepers =================
     Everything runs towards -z. Walls with a small hole you can only crouch through; Miss Mimicker smashes them. */
  const C3W = 10, C3H = 14, WT = .8;                       // half width / height of the big spaces, wall thickness
  const Z_BACK = 8, Z_W1 = -26, Z_W2 = -96, Z_LR = -130;   // back wall, hole wall 1, hole wall 2, laser room far wall
  const HOLE = { w: 1.3, h: 1.05 };
  const LAS = { x0: -12, x1: 12, h: 16 };                  // laser room: z from Z_LR to Z_W2 - WT
  const SL = { hw: 9, len: 20, h: 9 };                     // sleeping rooms
  const ROOMS = [0, 1, 2, 3].map(k => { const zTop = Z_LR - WT - k * (SL.len + WT); return { k, zTop, zBot: zTop - SL.len, exitX: k % 2 ? 7 : -7, entryX: k ? (k % 2 ? -7 : 7) : 8 }; });
  const LAS_HOLE_X = 8;
  const LEVER = [0, 0, -3.5];
  const CONSOLE = [6.5, 0, -103.5];
  const GUN = { z: -124, y: 7.2, muzzle: -108.6 };          // the laser points back up the level (+z)
  // standing on: raised junk platforms [x0, x1, z0, z1, top]
  const C3_JUNK = [
    [-C3W, C3W, -34.3, -33.7, .6],                                   // low barrier: jump it
    [-C3W, C3W, -66, -64, .75], [-C3W, C3W, -62.4, -60, .75],        // a junk deck with a gap: jump up, jump across
    [-C3W, -2.5, -78.3, -77.7, .6], [2.5, C3W, -78.3, -77.7, .6], [-2.5, 2.5, -78.3, -77.7, .6]   // second low barrier
  ];
  const C3_PIT = [-C3W, C3W, -64, -62.4];
  // walls you cannot pass, plus 'stand' blockers (only stop you while standing): [x0, x1, z0, z1, top, standOnly]
  function holeWall(list, x0, x1, z0, z1, hx, top) {
    list.push([x0, hx - HOLE.w / 2, z0, z1, top], [hx + HOLE.w / 2, x1, z0, z1, top], [hx - HOLE.w / 2, hx + HOLE.w / 2, z0, z1, top, 1]);
  }
  function buildSolids3() {
    const T = 99, s = [];
    s.push([-C3W - .4, -C3W, Z_W2, Z_BACK, T], [C3W, C3W + .4, Z_W2, Z_BACK, T]);           // side walls hall + junkyard
    s.push([-C3W, -6, Z_BACK, Z_BACK + .4, T], [6, C3W, Z_BACK, Z_BACK + .4, T], [-6, 6, Z_BACK, Z_BACK + .4, T, 0, 'back']);   // back wall: she smashes the middle
    for (const [z, key] of [[Z_W1, 'w1'], [Z_W2, 'w2']]) {
      s.push([-C3W, -7, z - WT, z, T], [7, C3W, z - WT, z, T]);
      const n = s.length; holeWall(s, -7, 7, z - WT, z, 0, T); for (let i = n; i < s.length; i++) s[i][6] = key;
    }
    s.push([LAS.x0 - .4, LAS.x0, Z_LR, Z_W2 - WT, T], [LAS.x1, LAS.x1 + .4, Z_LR, Z_W2 - WT, T]);
    s.push([-C3W - .4, LAS.x0, Z_W2 - WT, Z_W2, T], [C3W, LAS.x1 + .4, Z_W2 - WT, Z_W2, T]);
    holeWall(s, LAS.x0, LAS.x1, Z_LR - WT, Z_LR, LAS_HOLE_X, T);
    s.push([LAS_HOLE_X - HOLE.w / 2, LAS_HOLE_X + HOLE.w / 2, Z_LR - .1, Z_LR + .25, T, 0, 'grate']);   // the vent cover (falls off after the blast)
    s.push([LEVER[0] - .45, LEVER[0] + .45, LEVER[2] - .3, LEVER[2] + .3, 1.05]);   // the lever's stand
    // pipes you crouch under, and the junk tunnel
    s.push([-C3W, C3W, -42.4, -41.6, T, 1]);
    s.push([-C3W, -1.0, -84.5, -81.5, T], [1.0, C3W, -84.5, -81.5, T], [-1.0, 1.0, -84.5, -81.5, T, 1]);
    // slalom crate walls
    s.push([-C3W, 1.5, -49.2, -47.8, T], [-1.5, C3W, -55.2, -53.8, T]);
    // the laser gun base and the console
    s.push([-4.5, 4.5, GUN.z - 5, GUN.z + 4.5, T], [CONSOLE[0] - .55, CONSOLE[0] + .55, CONSOLE[2] - .45, CONSOLE[2] + .45, T]);
    for (const R of ROOMS) {
      s.push([-SL.hw - .4, -SL.hw, R.zBot, R.zTop, T], [SL.hw, SL.hw + .4, R.zBot, R.zTop, T]);
      holeWall(s, -SL.hw, SL.hw, R.zBot - WT, R.zBot, R.exitX, T);
    }
    s.push([-SL.hw, SL.hw, ROOMS[3].zBot - WT - 3.4, ROOMS[3].zBot - WT - 3, T], [-SL.hw, SL.hw, ROOMS[3].zBot - WT - 3.4, ROOMS[3].zBot - WT, T, 1]);   // the last crawlway
    for (const b of C3_JUNK) s.push(b);
    return s;
  }
  function c3Ground(x, z, feet) {
    let g = 0;
    for (const b of C3_JUNK) if (x >= b[0] - .15 && x <= b[1] + .15 && z >= b[2] - .15 && z <= b[3] + .15 && b[4] <= feet + .42) {
      g = Math.max(g, b[4]);
    }
    return g;
  }
  // the sleepers: [rig key, lying length (m), yaw while lying, centre x offset]
  const SLEEPERS = [['kabob', 7.5, .25, 0], ['bitter', 6.5, -.2, .5], ['josh', 7.5, .3, -.5], ['dadadoo', 7, -.25, 0]];
  const C3_LAMPS = [[0, 2], [0, -14], [0, -40], [0, -58], [0, -76], [0, -90]];

  function c3Wall(g, z, x0, x1, h, hx, dir, su) {   // a wall facing `dir` with a crawl hole at hx
    g.qz(z, x0, hx - HOLE.w / 2, 0, h, dir, su, su); g.qz(z, hx + HOLE.w / 2, x1, 0, h, dir, su, su); g.qz(z, hx - HOLE.w / 2, hx + HOLE.w / 2, HOLE.h, h, dir, su, su);
  }
  function c3HoleTunnel(g, z0, z1, hx) {
    g.qy(hx - HOLE.w / 2, hx + HOLE.w / 2, z0, z1, 0, true, 1);
    g.qx(hx - HOLE.w / 2, z0, z1, 0, HOLE.h, 1, 1, 1); g.qx(hx + HOLE.w / 2, z0, z1, 0, HOLE.h, -1, 1, 1); g.qy(hx - HOLE.w / 2, hx + HOLE.w / 2, z0, z1, HOLE.h, false, 1);
  }
  function buildWorld3() {
    const g = {};
    for (const k of ['floor', 'wall', 'ceil', 'brk', 'dark', 'metal', 'rust', 'wood', 'crate', 'pipe', 'lamp', 'tube', 'gun', 'gunDark', 'lasWall', 'room', 'roomFloor', 'tunnel', 'red', 'hazard']) g[k] = new Geo();
    const S = 3.2;
    /* floors + ceilings */
    g.floor.qy(-C3W, C3W, Z_W2, Z_BACK, 0, true, 3);
    g.ceil.qy(-C3W, C3W, Z_W2, Z_BACK, C3H, false, 4);
    g.floor.qy(LAS.x0, LAS.x1, Z_LR, Z_W2 - WT, 0, true, 3); g.ceil.qy(LAS.x0, LAS.x1, Z_LR, Z_W2 - WT, LAS.h, false, 4);
    /* hall + junkyard side walls */
    g.wall.qx(-C3W, Z_W2, Z_BACK, 0, C3H, 1, S, S); g.wall.qx(C3W, Z_W2, Z_BACK, 0, C3H, -1, S, S);
    // back wall: the middle part is breakable
    g.wall.qz(Z_BACK, -C3W, -6, 0, C3H, -1, S, S); g.wall.qz(Z_BACK, 6, C3W, 0, C3H, -1, S, S); g.wall.qz(Z_BACK, -6, 6, 10, C3H, -1, S, S);
    g.brk.qz(Z_BACK, -6, 6, 0, 10, -1, S, S);
    // her den behind the back wall
    g.dark.qy(-8, 8, Z_BACK, Z_BACK + 26, 0, true, 3); g.dark.qy(-8, 8, Z_BACK, Z_BACK + 26, C3H, false, 3);
    g.dark.qx(-8, Z_BACK, Z_BACK + 26, 0, C3H, 1, 3, 3); g.dark.qx(8, Z_BACK, Z_BACK + 26, 0, C3H, -1, 3, 3); g.dark.qz(Z_BACK + 26, -8, 8, 0, C3H, -1, 3, 3);
    // hole walls 1 and 2: outer parts static, the middle (with the hole) breakable
    for (const [z, key] of [[Z_W1, 'w1'], [Z_W2, 'w2']]) {
      for (const [zz, d] of [[z, 1], [z - WT, -1]]) {
        g.wall.qz(zz, -C3W, -7, 0, C3H, d, S, S); g.wall.qz(zz, 7, C3W, 0, C3H, d, S, S); g.wall.qz(zz, -7, 7, 11, C3H, d, S, S);
        c3Wall(g[key] = g[key] || new Geo(), zz, -7, 7, 11, 0, d, S);
      }
      c3HoleTunnel(g[key], z - WT, z, 0);
    }
    // the laser room shell
    for (const [zz, d] of [[Z_W2 - WT, -1]]) { g.lasWall.qz(zz, LAS.x0, -C3W, 0, LAS.h, d, S, S); g.lasWall.qz(zz, C3W, LAS.x1, 0, LAS.h, d, S, S); g.lasWall.qz(zz, -C3W, C3W, C3H, LAS.h, d, S, S); }
    g.lasWall.qx(LAS.x0, Z_LR, Z_W2 - WT, 0, LAS.h, 1, S, S); g.lasWall.qx(LAS.x1, Z_LR, Z_W2 - WT, 0, LAS.h, -1, S, S);
    c3Wall(g.lasWall, Z_LR, LAS.x0, LAS.x1, LAS.h, LAS_HOLE_X, 1, S);
    c3HoleTunnel(g.tunnel, Z_LR - WT, Z_LR, LAS_HOLE_X);
    /* junkyard: barriers, pipes, slalom, the deck, the junk tunnel */
    const box = (k, b, y0 = 0) => g[k].box(b[0], y0, b[2], b[1], b[4], b[3], 1, 1);
    box('rust', C3_JUNK[0]); for (let x = -9.5; x < 10; x += 2.4) g.metal.box(x - .06, 0, -34.4, x + .06, .75, -33.6);
    g.hazard.box(-C3W, .6, -34.32, C3W, .66, -33.68, 2, 2);
    for (const y of [1.25, 1.6, 1.95]) g.pipe.cylX(-C3W, C3W, y, -42 + (y - 1.6) * .3, .17, 12);
    for (let x = -9; x <= 9; x += 3) g.metal.box(x - .07, 1.08, -42.35, x + .07, 2.2, -41.65);
    for (let x = -10; x < 1.5; x += 1.45) { g.crate.box(x, 0, -49.2, Math.min(x + 1.4, 1.5), 1.4, -47.8, .9, .9); g.crate.box(x + .3, 1.4, -49.1, Math.min(x + 1.5, 1.5), 2.6, -47.9, .9, .9); }
    for (let x = -1.5; x < 10; x += 1.45) { g.crate.box(x, 0, -55.2, Math.min(x + 1.4, 10), 1.4, -53.8, .9, .9); g.crate.box(x, 1.4, -55.1, Math.min(x + 1.2, 10), 2.6, -53.9, .9, .9); }
    // the deck (with the gap)
    g.wood.box(-C3W, 0, -66, C3W, .75, C3_PIT[2], 1, 1); g.wood.box(-C3W, 0, C3_PIT[3], C3W, .75, -60, 1, 1);
    g.hazard.box(-C3W, .75, -60.06, C3W, .78, -59.98, 2, 2); g.dark.qy(-C3W, C3W, C3_PIT[2], C3_PIT[3], .02, true, 2);
    box('rust', C3_JUNK[3]); box('rust', C3_JUNK[4]); box('metal', C3_JUNK[5]);
    // junk tunnel: two heaps with a low crawl gap between
    g.crate.box(-C3W, 0, -84.5, -1.0, 3.2, -81.5, .9, .9); g.crate.box(1.0, 0, -84.5, C3W, 3.2, -81.5, .9, .9);
    g.metal.box(-1.05, 1.05, -84.5, 1.05, 1.25, -81.5); g.crate.box(-1.0, 1.25, -84.4, 1.0, 3.0, -81.6, .9, .9);
    // scattered junk along the sides (looks only)
    const rnd = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? 1 : -1, z = -28 - rnd(i) * 66, x = side * (6.2 + rnd(i + 50) * 3.3), w = .6 + rnd(i + 9) * 1.1, h = .4 + rnd(i + 3) * 1.6;
      if (z < -77 && z > -86) continue;
      const k = ['crate', 'rust', 'metal', 'wood'][i % 4];
      g[k].boxR(x, h / 2, z, w / 2, h / 2, w / 2 * (.7 + rnd(i + 7) * .6), 0, rnd(i + 11) * 2, 0);
    }
    for (let i = 0; i < 10; i++) { const z = -30 - i * 6.5, x = (i % 2 ? 1 : -1) * (7.5 + rnd(i + 70)); g.rust.cyl(x, z, 0, 1.2, .45, .45, 12); g.dark.disk(x, 1.2, z, .45, 12, true); }   // barrels
    // hall details
    g.metal.box(LEVER[0] - .45, 0, LEVER[2] - .3, LEVER[0] + .45, 1.05, LEVER[2] + .3); g.hazard.box(LEVER[0] - .47, .95, LEVER[2] - .32, LEVER[0] + .47, 1.0, LEVER[2] + .32, 1, 1);
    for (const x of [-9.4, 9.4]) for (let z = 4; z > -24; z -= 7) g.metal.box(x - .3, 0, z - .3, x + .3, C3H, z + .3);
    // lamps
    for (const [x, z] of C3_LAMPS) { g.lamp.box(x - 1.2, C3H - .25, z - .35, x + 1.2, C3H, z + .35); g.tube.box(x - 1.1, C3H - .3, z - .22, x + 1.1, C3H - .25, z + .22); }
    /* the laser gun */
    const Z = GUN.z;
    g.gunDark.box(-4.5, 0, Z - 5, 4.5, 1.6, Z + 4.5, 2, 2); g.hazard.box(-4.55, 1.6, Z - 5.05, 4.55, 1.68, Z + 4.55, 2, 2);
    g.gun.cyl(0, Z - 1, 1.6, 4.6, 2.6, 2.1, 20);
    g.gun.box(-3.2, 4.4, Z - 4.2, 3.2, 9.6, Z + 3.5, 1.5, 1.5); g.gunDark.box(-3.3, 5.0, Z - 3.8, 3.3, 5.4, Z + 3.6); g.gunDark.box(-3.3, 8.6, Z - 3.8, 3.3, 9.0, Z + 3.6);
    g.gun.cylZ(Z + 3.5, GUN.muzzle, 0, GUN.y, 1.25, 20); g.gunDark.cylZ(GUN.muzzle + 1.4, GUN.muzzle, 0, GUN.y, 1.55, 20);
    for (const s of [-1, 1]) { g.gunDark.cylZ(Z + 3.5, Z - 3, s * 3.6, 6.4, .5, 10); g.metal.box(s * 3.3, 1.6, Z - 1, s * 3.9, 6.4, Z + 1); }
    for (let i = 0; i < 6; i++) g.gunDark.cylZ(Z + 4.2 + i * 2.1 - .25, Z + 4.2 + i * 2.1 + .25, 0, GUN.y, 1.42, 20);
    g.gunDark.box(-.4, 9.6, Z - 2, .4, 11.5, Z - 1.2); g.metal.box(-1.6, 11.3, Z - 2.2, 1.6, 11.5, Z - 1);
    // cables to the console
    for (let i = 0; i < 6; i++) { const t = i / 5; g.dark.box(lerp(3.3, CONSOLE[0], t) - .1, 0, lerp(Z + 2, CONSOLE[2], t) - .1, lerp(3.3, CONSOLE[0], t) + .1, .12, lerp(Z + 2, CONSOLE[2], t) + .1); }
    // the console
    g.gunDark.box(CONSOLE[0] - .55, 0, CONSOLE[2] - .45, CONSOLE[0] + .55, 1.0, CONSOLE[2] + .45); g.metal.box(CONSOLE[0] - .6, 1.0, CONSOLE[2] - .5, CONSOLE[0] + .6, 1.08, CONSOLE[2] + .5);
    g.gunDark.boxR(CONSOLE[0], 1.45, CONSOLE[2] - .32, .55, .38, .05, -.35, 0, 0);
    /* the sleeping rooms */
    for (const R of ROOMS) {
      g.roomFloor.qy(-SL.hw, SL.hw, R.zBot, R.zTop, 0, true, 2); g.room.qy(-SL.hw, SL.hw, R.zBot, R.zTop, SL.h, false, 3);
      g.room.qx(-SL.hw, R.zBot, R.zTop, 0, SL.h, 1, S, S); g.room.qx(SL.hw, R.zBot, R.zTop, 0, SL.h, -1, S, S);
      c3Wall(g.room, R.zTop - .01, -SL.hw, SL.hw, SL.h, R.entryX, -1, S);
      c3Wall(g.room, R.zBot, -SL.hw, SL.hw, SL.h, R.exitX, 1, S); c3Wall(g.room, R.zBot - WT, -SL.hw, SL.hw, SL.h, R.exitX, -1, S);
      c3HoleTunnel(g.tunnel, R.zBot - WT, R.zBot, R.exitX);
      g.lamp.box(-.5, SL.h - .15, (R.zTop + R.zBot) / 2 - .5, .5, SL.h, (R.zTop + R.zBot) / 2 + .5);
      // a few bits of furniture against the walls
      g.crate.box(-SL.hw, 0, R.zTop - 4, -SL.hw + 1.2, 1.1, R.zTop - 2.6, .9, .9); g.crate.box(SL.hw - 1.4, 0, R.zBot + 2, SL.hw, 1.3, R.zBot + 3.6, .9, .9);
      g.wood.box(SL.hw - .6, 0, R.zTop - 9, SL.hw, 2.2, R.zTop - 6.5, .9, .9);
    }
    // the last crawlway out
    const zEnd = ROOMS[3].zBot - WT;
    g.tunnel.qy(-SL.hw, SL.hw, zEnd - 3.4, zEnd, 0, true, 2); g.tunnel.qy(-SL.hw, SL.hw, zEnd - 3.4, zEnd, HOLE.h, false, 2); g.tunnel.qz(zEnd - 3.4, -SL.hw, SL.hw, 0, HOLE.h, 1, 2, 2);
    return g;
  }
  function buildGrate() { const g = new Geo(); for (let i = 0; i < 6; i++) g.box(-HOLE.w / 2 + i * HOLE.w / 5 - .025, 0, -.03, -HOLE.w / 2 + i * HOLE.w / 5 + .025, HOLE.h, .03); for (const y of [.05, .5, 1.0]) g.box(-HOLE.w / 2, y - .025, -.04, HOLE.w / 2, y + .025, .04); return g; }
  function buildLever() { const g = new Geo(); g.box(-.05, 0, -.05, .05, .55, .05); g.box(-.12, .5, -.12, .12, .62, .12); return g; }

  /* ================= chapter 3 main ================= */
  const X_ = a => Q.aa(1, 0, 0, a);
  function mimSpec(run, ph, roar) {   // Miss Mimicker's gallop, as rotations about the model's own left-right axis
    const leg = (a, b) => ({ a: Math.sin(ph + a), c: Math.cos(ph + a) }), d = {};
    const amp = 38 * D * run, bend = 34 * D * run;
    for (const [up, mid, off] of [['arm01_l_029', 'arm02_l_030', 0], ['arm01_r_034', 'arm02_r_035', .7]]) { const l = leg(off); d[up] = X_(-amp * l.a - roar * 35 * D); d[mid] = X_(18 * D + bend * Math.max(0, l.c) + roar * 30 * D); }
    for (const [up, mid, off] of [['leg01_l_041', 'leg02_l_042', 2.6], ['leg01_r_046', 'leg02_r_047', 3.3]]) { const l = leg(off); d[up] = X_(amp * l.a); d[mid] = X_(-bend * Math.max(0, l.c)); }
    d.chest_02 = X_(7 * D * Math.cos(ph * 2) * run - roar * 6 * D); d.head_04 = X_(-6 * D * Math.cos(ph * 2) * run + roar * 22 * D); d.neck_03 = X_(roar * 8 * D);
    return d;
  }
  const BIPED = { josh: { thL: 'LegL', shL: 'MiddleLegL', thR: 'LegR', shR: 'MiddleLegR', arL: 'ArmL', arR: 'ArmR' } };
  function bipedSpec(n, run, ph, roar) {
    const s = Math.sin(ph), c = Math.cos(ph), d = {};
    d[n.thL] = X_(-34 * D * s * run); d[n.thR] = X_(34 * D * s * run);
    d[n.shL] = X_(45 * D * Math.max(0, c) * run); d[n.shR] = X_(45 * D * Math.max(0, -c) * run);
    d[n.arL] = X_(30 * D * s * run - roar * 70 * D); d[n.arR] = X_(-30 * D * s * run - roar * 70 * D);
    return d;
  }
  const SLEEPER_NAME = { kabob: 'Mr. Kabob', bitter: 'Bittergiggle', josh: 'Jumbo Josh', dadadoo: 'Sir Dadadoo' };
  function hazardTexture() { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8b51c'; for (let x = -128; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 + 128, h); g.lineTo(x + 128, h); g.fill(); } }); }
  function zTexture() { return canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8b8ff'; g.font = 'bold 104px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Z', w / 2, h / 2 + 6); }); }

  async function startC3(opts) {
    const canvas = opts.canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 not available');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const container = opts.container || canvas.parentElement;
    const progW = compile(gl, VS_WORLD, FS), progS = compile(gl, VS_SKIN, FS);

    /* ---- world ---- */
    const W = buildWorld3(); const M = {}; for (const k in W) M[k] = meshFromGeo(gl, W[k]);
    const grateM = meshFromGeo(gl, buildGrate()), leverM = meshFromGeo(gl, buildLever());
    const cubeG = new Geo(); cubeG.box(-.5, -.5, -.5, .5, .5, .5, .8, .8); const cubeM = meshFromGeo(gl, cubeG);
    const spriteG = new Geo(); spriteG.quad([-.5, -.5, 0], [.5, -.5, 0], [.5, .5, 0], [-.5, .5, 0], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]); const sprite = meshFromGeo(gl, spriteG);
    const ringMs = []; for (let i = 0; i < 6; i++) { const g = new Geo(); const z = GUN.z + 4.2 + i * 2.1; g.cylZ(z - .22, z + .22, 0, GUN.y, 1.47, 24); ringMs.push(meshFromGeo(gl, g)); }
    const cylG = new Geo(); cylG.cylZ(0, 1, 0, 0, 1, 12); const cylM = meshFromGeo(gl, cylG);
    const texFloor = texFromCanvas(gl, floorTexture(), aniso), texWall = texFromCanvas(gl, wallTexture(), aniso), texHaz = texFromCanvas(gl, hazardTexture(), aniso), texZ = texFromCanvas(gl, zTexture(), aniso);
    const solids = buildSolids3();

    /* ---- characters ---- */
    const mim = makeRig(gl, opts.mimicker);
    const MB = mim.meta.bbox, MS = 8 / (MB[1][1] - MB[0][1]), M_CTR = [(MB[0][0] + MB[1][0]) / 2, MB[0][1], (MB[0][2] + MB[1][2]) / 2];
    const M_HEAD = (MB[1][2] - M_CTR[2]) * MS, M_HALF = (M_CTR[2] - MB[0][2]) * MS, M_W = (MB[1][0] - MB[0][0]) / 2 * MS * .85;
    const sleeperRig = {};
    function ensureSleeper(key) {
      if (sleeperRig[key] || !opts.getSleeper) return sleeperRig[key] || null;
      const d = opts.getSleeper(key); if (!d) return null;
      try {
        const rig = makeRig(gl, d), b = rig.meta.bbox, L = SLEEPERS.find(s => s[0] === key)[1], sc = L / (b[1][1] - b[0][1]);
        sleeperRig[key] = { rig, sc, ctr: [0, 1, 2].map(i => (b[0][i] + b[1][i]) / 2), halfH: (b[1][1] - b[0][1]) / 2 * sc, halfW: (b[1][0] - b[0][0]) / 2 * sc, halfD: (b[1][2] - b[0][2]) / 2 * sc, clips: rig.meta.clips || {} };
      } catch (e) { console.error(e); return null; }
      return sleeperRig[key];
    }

    /* ---- hud, audio ---- */
    const hud = makeHud(container, { deadTitle: 'YOU GOT<br>CAUGHT', endTitle: 'CHAPTER 3<br>COMPLETE' });
    const mpAv = opts.mp ? makeMpAvatars(gl, container) : null;
    const sfx = makeAudio(opts.getAC, opts.sfxOn || (() => true));
    const A = opts.audio || {};
    const musicVol = opts.musicVol || (() => 1), musicOn = opts.musicOn || (() => true);

    /* ---- state ---- */
    const st = {
      phase: 'wake', t: 0, camYaw: 0, camPitch: 0, eye: [0, 1.62, 2.5], wakeT: 0, dragYaw: 0, dragPitch: 0,
      p: { x: 0, y: 0, z: 2.5, vy: 0, yaw: 0, pitch: 0, bob: 0, lastStep: 0, moving: 0, grounded: true },
      crouch: false, crouchK: 0, cp: 'hall', broken: { back: false, w1: false, w2: false, grate: false }, alarmT: -1, leverT: -1,
      charge: 0, armed: false, fireT: -1, mimDead: false, room: -1, noise: 0, saidRoom: {}, cleared: [false, false, false, false],
      caughtBy: null, caughtT: -1, act: null, shk: { t0: -9, amp: 0, dur: 1 }, toastUntil: 0, toastKey: '', timers: [], hints: {}
    };
    const mm = { state: 'hidden', x: 0, z: Z_BACK + 11, yaw: Math.PI, ph: 0, run: 0, roar: 0, rear: 0, smashT: -1, smashKey: null, stepT: 0, growlT: 0, glow: 0, hitT: -1, resumeT: 0 };
    const sleepers = ROOMS.map((R, k) => ({ k, key: SLEEPERS[k][0], home: [SLEEPERS[k][3], (R.zTop + R.zBot) / 2, SLEEPERS[k][2]], x: SLEEPERS[k][3], z: (R.zTop + R.zBot) / 2, yaw: SLEEPERS[k][2], state: 'sleep', lie: 1, animT: 0, ph: 0, run: 0, roar: 0, t0: 0, snoreT: 0, stirT: -9 }));
    const chunks = [], fires = [], debris = [];
    const later = (dt, fn) => st.timers.push({ at: st.t + dt, fn });

    /* ---- playing together: the leader's game runs the story and the monsters, friends see the same ---- */
    const roomOf = (x, z) => { for (const R of ROOMS) if (z < R.zTop && z > R.zBot - WT && Math.abs(x) < SL.hw) return R.k; return -1; };
    const coop = makeCoop(opts, st, hud, sfx, {
      R: { st, mm, sl: sleepers },
      ctl: () => controlling(),
      music: { borrowed: A.borrowed },
      dangerAt: (f) => {
        if (st.phase === 'chase' && mm.state === 'chase') {
          const head = mimHead(), dH = Math.hypot(f[0] - head[0], f[2] - head[2]);
          const fw = (f[0] - mm.x) * Math.sin(mm.yaw) + (f[2] - mm.z) * Math.cos(mm.yaw), l = (f[0] - mm.x) * Math.cos(mm.yaw) - (f[2] - mm.z) * Math.sin(mm.yaw);
          if ((fw > -M_HALF && fw < M_HEAD + 1.6 && Math.abs(l) < M_W + .3) || dH < 3) return true;
        }
        for (const s of sleepers) if (s.state === 'chase') {
          const R = sleeperRig[s.key], reach = 2.6 + (R ? R.halfD * .3 : 0);
          if (roomOf(f[0], f[2]) === s.k && Math.hypot(f[0] - s.x, f[2] - s.z) < reach) return true;
        }
        return false;
      },
      doAct: (k) => {
        if (k === 'lever' && st.phase === 'explore' && st.leverT < 0) pullLever();
        else if (k === 'charge' && st.phase === 'chase' && !st.armed) chargeGun();
        else if (/^wake[0-3]$/.test(k) && st.phase === 'free') wakeSleeper(sleepers[+k[4]]);
        else if (k === 'end' && st.phase === 'free') finish();
      },
      onShared: (a, b) => {
        for (const key of ['back', 'w1', 'w2']) if (!a.st.broken[key] && b.st.broken[key]) spawnChunks(key);
        if (!a.st.mimDead && b.st.mimDead) spawnBlast();
      },
      afterTeleport: hp => setCrouch(!!hp[4]),
      showAct: k => setAct(k)
    });
    const G = !!(coop && coop.guest);
    let gRoom = -1, gNoise = 0, gStir = -9;

    /* ---- input ---- */
    const joy = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
    let lookId = null, lx = 0, ly = 0;
    const keys = { f: 0, b: 0, l: 0, r: 0 };
    const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    const CONTROL = ['explore', 'chase', 'free'];
    const controlling = () => CONTROL.includes(st.phase) && !(G && coop.blocked());
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
      if (e.type !== 'keydown' || e.repeat) return;
      if (e.code === 'Space') { e.preventDefault(); doJump(); }
      if (e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); onAct(); }
      if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ShiftLeft') { e.preventDefault(); toggleCrouch(); }
    };
    const onBlur = () => { keys.f = keys.b = keys.l = keys.r = 0; };
    hud.zone.addEventListener('pointerdown', onZoneDown); canvas.addEventListener('pointerdown', onCanvasDown);
    const mouse = makeMouseLock(canvas, hud, (dx, dy) => look(dx * .45, dy * .45));   // computer: locked mouse to look around
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur);
    onPress(hud.jump, doJump); onPress(hud.act, () => onAct()); onPress(hud.crouch, () => toggleCrouch());
    hud.endBtn.addEventListener('click', () => { opts.onExit && opts.onExit(); });
    hud.respawn.addEventListener('click', () => respawn());

    /* ---- helpers ---- */
    function setObjective(text, alarm) { hud.obj.textContent = text || ''; hud.obj.classList.toggle('show', !!text); hud.obj.classList.toggle('alarm', !!alarm); }
    function toast(text, key, secs = 3) {
      if (key && st.toastKey === key && st.t < st.toastUntil + 4) return;
      st.toastKey = key || text; st.toastUntil = st.t + secs; hud.toast.textContent = text; hud.toast.classList.add('show');
    }
    function hintOnce(key, text, secs) { if (st.hints[key]) return; st.hints[key] = 1; toast(text, key, secs); }
    function setControls(on) {
      hud.zone.classList.toggle('on', on); hud.jump.classList.toggle('show', !!on); hud.crouch.classList.toggle('show', !!on);
      if (!on) { joy.id = null; joy.x = joy.y = 0; resetJoy(); setAct(null); } else resetJoy();
    }
    const ACT_LABEL = { lever: 'PULL', charge: '<span style="font-size:.74em">CHARGE</span>' };
    function setAct(kind) {
      if (kind !== st.act) { st.act = kind; hud.act.classList.toggle('show', !!kind); if (kind) hud.label.innerHTML = ACT_LABEL[kind]; }
      const pk = kind === 'charge' ? 'c' + st.charge : kind;
      if (pk !== st.pipKey) { st.pipKey = pk; hud.pips.innerHTML = kind === 'charge' ? [0, 1, 2, 3, 4, 5].map(i => '<i class="' + (i < st.charge ? 'on' : '') + '"></i>').join('') : ''; }
    }
    function shake(amp, dur) { if (amp >= st.shk.amp * Math.max(0, 1 - (st.t - st.shk.t0) / st.shk.dur)) st.shk = { t0: st.t, amp, dur }; }
    function playMusic(el) { if (!el) return; try { el.currentTime = 0; el.loop = true; el.muted = !musicOn(); el.volume = musicVol(); } catch (e) {} const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    const blockers = () => {
      const list = solids.filter(b => !(b[6] && st.broken[b[6]]));
      for (const s of sleepers) if (s.state === 'sleep') { const r = ensureSleeper(s.key); if (r) list.push([s.x - r.halfH * .95, s.x + r.halfH * .95, s.z - 1.9, s.z + 1.9, 99]); }
      return list;
    };
    const STEP = .42;
    function collide(p) {
      const r = .3, list = blockers();
      for (let it = 0; it < 2; it++) for (const b of list) {
        if (b[5] && st.crouch) continue;
        if (b[4] <= p.y + STEP) continue;
        const cx = clamp(p.x, b[0], b[1]), cz = clamp(p.z, b[2], b[3]);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
        else { const pen = [[p.x - b[0] + r, -1, 0], [b[1] - p.x + r, 1, 0], [p.z - b[2] + r, 0, -1], [b[3] - p.z + r, 0, 1]].sort((u, w) => u[0] - w[0])[0]; p.x += pen[1] * pen[0]; p.z += pen[2] * pen[0]; }
      }
    }
    function underLow(p) {   // is there something low above you (a crawl hole or the pipes)?
      for (const b of solids) if (b[5] && !(b[6] && st.broken[b[6]])) { const cx = clamp(p.x, b[0], b[1]), cz = clamp(p.z, b[2], b[3]); if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < .3 * .3) return true; }
      return false;
    }
    function toggleCrouch() {
      if (!controlling()) return;
      if (st.crouch) { if (underLow(st.p)) { toast('Not enough room to stand up here', 'low', 1.6); return; } st.crouch = false; }
      else st.crouch = true;
      hud.crouch.classList.toggle('on', st.crouch); hud.crouch.textContent = st.crouch ? 'STAND' : 'CROUCH'; hud.crouch.classList.remove('hint');
    }
    function setCrouch(on) { st.crouch = on; st.crouchK = on ? 1 : 0; hud.crouch.classList.toggle('on', on); hud.crouch.textContent = on ? 'STAND' : 'CROUCH'; }
    function doJump() {
      if (!controlling()) return;
      if (st.crouch) { toggleCrouch(); return; }
      if (st.p.grounded) { st.p.vy = 6.6; st.p.grounded = false; sfx.jump(); if (st.room >= 0) st.noise = Math.min(1.2, st.noise + .35); }
    }
    function onAct() {
      if (!controlling() || !st.act) return;
      if (G) { coop.sendAct(st.act); if (st.act === 'lever') setAct(null); return; }
      if (st.act === 'lever') pullLever();
      else if (st.act === 'charge') chargeGun();
    }

    /* ---- story beats ---- */
    function beginExplore() {
      st.phase = 'explore'; st.p.yaw = st.camYaw; st.p.pitch = st.camPitch; st.dragYaw = st.dragPitch = 0;
      setControls(true); setObjective('Pull the lever'); hud.lids.classList.remove('on');
      if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) { hud.keys.textContent = 'WASD to move \u00b7 click to lock the mouse \u00b7 space jump \u00b7 C crouch \u00b7 E use'; hud.keys.classList.add('show'); setTimeout(() => hud.keys.classList.remove('show'), 9000); }
    }
    function pullLever() {
      st.leverT = st.t; st.phase = 'alarm'; setControls(false); setObjective(''); sfx.clang(.8); sfx.lock();
      st.turnFrom = st.p.yaw; st.pitchFrom = st.p.pitch;
      later(.5, () => { st.alarmT = st.t; hud.red.classList.add('on'); });
      later(1.3, () => { sfx.rumble(); shake(.03, 1.2); mm.state = 'reveal'; });
      later(2.3, () => breakWall('back'));
      later(2.5, () => { sfx.roar(1.4); shake(.06, 1.4); });
      later(2.8, () => playMusic(A.borrowed));
      later(4.4, () => { st.phase = 'chase'; st.p.yaw = 0; st.p.pitch = 0; setControls(true); setObjective('RUN!', true); mm.state = 'chase'; });
    }
    function breakWall(key) {
      st.broken[key] = true; sfx.crash(); sfx.boom(); shake(.07, 1.3);
      spawnChunks(key);
    }
    function spawnChunks(key) {
      const z = key === 'back' ? Z_BACK : key === 'w1' ? Z_W1 : Z_W2, n = 22;
      for (let i = 0; i < n; i++) {
        const sz = .7 + Math.random() * 1.3;
        chunks.push({ p: [(Math.random() - .5) * 12, .5 + Math.random() * 9.5, z - .4], s: [sz, sz * (.6 + Math.random() * .6), .5 + Math.random() * .4], v: [(Math.random() - .5) * 8, 2 + Math.random() * 6, -(5 + Math.random() * 9)], r: [0, 0, 0], w: [(Math.random() - .5) * 6, (Math.random() - .5) * 6, (Math.random() - .5) * 6], rest: false });
      }
    }
    function chargeGun() {
      if (st.charge >= 6 || st.fireT >= 0) return;
      st.charge++; sfx.charge(st.charge); shake(.01 * st.charge, .3); setAct('charge');
      if (st.charge >= 6) { st.armed = true; toast('FULLY CHARGED!', 'charged', 2); setAct(null); }
    }
    function mimInRoom() { return mm.z - M_HEAD < Z_W2 - WT - .5; }
    function fireGun() {
      st.fireT = st.t; st.phase = 'firing'; setControls(false); setObjective(''); sfx.zap(); shake(.06, 1.6);
      mm.state = 'hit'; mm.hitT = st.t;
      later(1.35, () => {
        sfx.boom(); sfx.crash(); shake(.12, 1.8); hud.flash.classList.remove('go'); void hud.flash.offsetWidth; hud.flash.classList.add('go');
        spawnBlast();
        mm.state = 'gone'; st.mimDead = true; st.alarmT = -1; hud.red.classList.remove('on');
        try { A.borrowed.pause(); } catch (e) {}
      });
      later(3.4, () => { st.broken.grate = true; st.grateT = st.t; sfx.clang(.9); });
      later(3.8, () => { st.phase = 'free'; st.cp = 'laser2'; setControls(true); setObjective('Crawl through the hole'); toast('Something knocked the vent cover off\u2026', 'vent', 3); });
    }
    function spawnBlast() {
      const c = mimHead(); for (let i = 0; i < 16; i++) fires.push({ p: [mm.x + (Math.random() - .5) * 8, 1 + Math.random() * 6, mm.z + (Math.random() - .5) * 12], v: [(Math.random() - .5) * 3, 1 + Math.random() * 2, (Math.random() - .5) * 3], t0: st.t + i * .04, size: 3 + Math.random() * 4, life: 1.6 + Math.random() });
        for (let i = 0; i < 24; i++) debris.push({ p: [mm.x + (Math.random() - .5) * 6, 1 + Math.random() * 6, mm.z + (Math.random() - .5) * 10], s: .4 + Math.random() * .9, v: [(Math.random() - .5) * 14, 4 + Math.random() * 8, (Math.random() - .5) * 14], r: [0, 0, 0], w: [(Math.random() - .5) * 9, (Math.random() - .5) * 9, (Math.random() - .5) * 9], rest: false });
    }
    function wakeSleeper(s) {
      if (s.state !== 'sleep') return;
      s.state = 'rise'; s.t0 = st.t; s.animT = 0; sfx.growl(1); shake(.03, 1);
      toast(SLEEPER_NAME[s.key].toUpperCase() + ' WOKE UP!', 'woke', 2.4); setObjective('RUN to the hole!', true);
    }
    function caught(by) {
      st.phase = 'caught'; st.caughtT = st.t; st.caughtBy = by; setControls(false); setObjective(''); sfx.scream(); sfx.roar(1.2); shake(.06, 1.4);
      later(1.5, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(2.0, () => { st.phase = 'dead'; hud.dead.classList.add('show'); });
    }
    function respawn() {
      if (G) { coop.respawn(); return; }
      if (st.phase !== 'dead') return;
      const p = st.p; hud.dead.classList.remove('show'); setObjective('');
      Object.assign(p, { vy: 0, pitch: 0, grounded: true, y: 0 });
      if (st.cp === 'hall' || st.cp === 'park' || st.cp === 'laser') {
        const z = st.cp === 'hall' ? -4 : st.cp === 'park' ? Z_W1 - WT - 1.5 : Z_W2 - WT - 2.2;
        Object.assign(p, { x: 0, z, yaw: 0 }); setCrouch(false);
        mm.state = 'wait'; mm.x = 0; mm.z = (st.cp === 'hall' ? 1.5 : st.cp === 'park' ? Z_W1 + 3 : Z_W2 + 4) + M_HEAD; mm.yaw = Math.PI; mm.rear = 0; mm.resumeT = st.t + (st.cp === 'laser' ? 2.2 : 1.6);
        if (st.cp === 'laser') { st.charge = 0; st.armed = false; }
        st.phase = 'chase'; setControls(true); setObjective(st.cp === 'laser' ? 'Charge the laser!' : 'RUN!', st.cp !== 'laser');
      } else {
        const k = +st.cp.slice(1), R = ROOMS[k], s = sleepers[k];
        Object.assign(p, { x: R.entryX, z: R.zTop - 1.3, yaw: 0 }); setCrouch(true);
        Object.assign(s, { state: 'sleep', lie: 1, x: s.home[0], z: s.home[1], yaw: s.home[2], run: 0, roar: 0 }); st.noise = 0;
        st.phase = 'free'; setControls(true); setObjective('Sneak past ' + SLEEPER_NAME[s.key]);
      }
      later(.15, () => { hud.black.classList.add('slow'); hud.black.classList.remove('on'); });
    }
    function finish() {
      st.phase = 'ending'; setControls(false); setObjective(''); hud.noise.classList.remove('show');
      later(.4, () => { hud.black.classList.remove('slow'); hud.black.classList.add('on'); });
      later(1.6, () => { st.phase = 'done'; hud.end.classList.add('show'); opts.onComplete && opts.onComplete(); });
    }

    /* ---- updates ---- */
    function mimHead() { const f = [Math.sin(mm.yaw), Math.cos(mm.yaw)]; return [mm.x + f[0] * M_HEAD, 5.2, mm.z + f[1] * M_HEAD]; }
    function updatePlayer(t, dt) {
      const p = st.p;
      st.crouchK = lerp(st.crouchK, st.crouch ? 1 : 0, Math.min(1, dt * 10));
      if (controlling()) {
        let mx = joy.x, my = joy.y;
        if (keys.f) my -= 1; if (keys.b) my += 1; if (keys.l) mx -= 1; if (keys.r) mx += 1;
        const mag = Math.min(1, Math.hypot(mx, my));
        if (mag > .06) {
          const n = Math.hypot(mx, my), ux = mx / n * mag, uy = my / n * mag;
          const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
          const sp = st.crouch ? 1.8 : st.phase === 'chase' ? 5.3 : 3.3;
          const mx2 = (fx * -uy + rx * ux) * sp * dt, mz2 = (fz * -uy + rz * ux) * sp * dt, n2 = Math.max(1, Math.ceil(Math.hypot(mx2, mz2) / .12));
          for (let k = 0; k < n2; k++) { p.x += mx2 / n2; p.z += mz2 / n2; collide(p); }
        }
        p.moving = lerp(p.moving, mag > .06 && p.grounded ? mag : 0, Math.min(1, dt * 8));
        p.bob += dt * p.moving * (st.crouch ? 5 : st.phase === 'chase' ? 12 : 8);
        const s = Math.sin(p.bob) > 0 ? 1 : -1;
        if (p.moving > .3 && s !== p.lastStep) { p.lastStep = s; sfx.pstep(st.crouch ? .12 : .3 + p.moving * .3); }
        if (G) guestProgress(t, dt); else updateProgress(t, dt);
      }
      let g = c3Ground(p.x, p.z, p.y);
      if (p.y > g + 1e-3 || p.vy > 0) { p.vy -= 20 * dt; p.y += p.vy * dt; if (p.y <= g) { if (p.vy < -5) { sfx.land(.6); if (st.room >= 0) st.noise = Math.min(1.2, st.noise + .25); } p.y = g; p.vy = 0; } }
      else { p.y = g; p.vy = 0; }
      p.grounded = p.y <= g + 1e-3;
    }
    function nearHole(p) {   // a crawl hole (or the pipes / junk tunnel) just ahead?
      const spots = [[0, Z_W1, 'w1', 'Crouch to fit through the hole!'], [0, -41.6, 'pipes', 'Crouch to get under the pipes!'], [0, -81.5, 'junk', 'Crouch to crawl under the junk!'], [0, Z_W2, 'w2', 'Crouch to fit through the hole!'], [LAS_HOLE_X, Z_LR, 'vent', 'Crouch to crawl into the vent!']].concat(ROOMS.map(R => [R.exitX, R.zBot, 'exit' + R.k, 'Crouch to crawl through!']));
      for (const sp of spots) { if (st.broken[sp[2]]) continue; if (Math.abs(p.x - sp[0]) < 2.4 && p.z - sp[1] < 3.2 && p.z - sp[1] > -.5) return sp; }
      return null;
    }
    function updateProgress(t, dt) {
      const p = st.p;
      // action button
      let act = null;
      if (st.phase === 'explore' && st.leverT < 0 && Math.hypot(p.x - LEVER[0], p.z - LEVER[2]) < 1.8) act = 'lever';
      if (st.phase === 'chase' && st.cp === 'laser' && !st.armed && Math.hypot(p.x - CONSOLE[0], p.z - CONSOLE[2]) < 2.0) act = 'charge';
      setAct(act);
      // crouch hints
      const nh = st.crouch ? null : nearHole(p);
      hud.crouch.classList.toggle('hint', !!nh);
      if (nh) hintOnce(nh[2], nh[3], 2.4);
      if (st.phase === 'chase' && Math.abs(p.z + 34) < 3 && p.z > -34) hintOnce('jump1', 'JUMP!', 1.4);
      if (st.phase === 'chase' && Math.abs(p.z + 60) < 2.5 && p.z > -60) hintOnce('jump2', 'Jump up onto the junk!', 1.8);
      // checkpoints
      if (st.cp === 'hall' && p.z < Z_W1 - WT) st.cp = 'park';
      if (st.cp === 'park' && p.z < Z_W2 - WT) { st.cp = 'laser'; setObjective('Charge the laser!'); toast('Press CHARGE 6 times!', 'charge', 3); }
      // the sleeping rooms
      let room = -1; for (const R of ROOMS) if (p.z < R.zTop && p.z > R.zBot - WT && Math.abs(p.x) < SL.hw) room = R.k;
      if (room !== st.room) {
        const prev = st.room;
        if (prev >= 0 && p.z < ROOMS[prev].zBot - WT && !st.cleared[prev]) { st.cleared[prev] = true; if (prev === 3) finish(); }
        st.room = room; st.noise = 0;
        if (room >= 0 && !st.saidRoom[room]) {
          st.saidRoom[room] = 1; st.cp = 'r' + room; const s = sleepers[room];
          setObjective('Sneak past ' + SLEEPER_NAME[s.key]); toast('Shh\u2026 crouch so you don\u2019t wake ' + (room === 1 ? 'it' : 'him') + '!', 'shh' + room, 3.2);
        }
      }
      hud.noise.classList.toggle('show', room >= 0 && sleepers[room].state === 'sleep');
      if (room >= 0) {
        const s = sleepers[room], d = Math.hypot(p.x - s.x, p.z - s.z);
        if (s.state === 'sleep') {
          const near = clamp(1 - (d - 2) / 9, 0, 1);
          if (p.moving > .25 && !st.crouch) st.noise += dt * (.35 + 1.1 * near);
          else if (p.moving > .25 && d < 4.2) st.noise += dt * .12;
          else st.noise = Math.max(0, st.noise - dt * .22);
          if (st.noise > .55 && t - s.stirT > 2.5) { s.stirT = t; sfx.growl(.5); hintOnce('stir' + room, 'Shh\u2026! It\u2019s stirring\u2026', 1.8); }
          if (st.noise >= 1) wakeSleeper(s);
          hud.noiseBar.style.width = Math.min(100, st.noise * 100) + '%';
        }
      }
    }
    function guestProgress(t, dt) {
      const p = st.p;
      let act = null;
      if (st.phase === 'explore' && st.leverT < 0 && Math.hypot(p.x - LEVER[0], p.z - LEVER[2]) < 1.8) act = 'lever';
      if (st.phase === 'chase' && p.z < Z_W2 - WT && !st.armed && Math.hypot(p.x - CONSOLE[0], p.z - CONSOLE[2]) < 2.0) act = 'charge';
      setAct(act);
      const nh = st.crouch ? null : nearHole(p);
      hud.crouch.classList.toggle('hint', !!nh);
      if (nh) hintOnce(nh[2], nh[3], 2.4);
      if (st.phase === 'chase' && Math.abs(p.z + 34) < 3 && p.z > -34) hintOnce('jump1', 'JUMP!', 1.4);
      if (st.phase === 'chase' && Math.abs(p.z + 60) < 2.5 && p.z > -60) hintOnce('jump2', 'Jump up onto the junk!', 1.8);
      const room = roomOf(p.x, p.z);
      if (room !== gRoom) {
        if (gRoom === 3 && room < 0 && p.z < ROOMS[3].zBot - WT) coop.sendAct('end');
        gRoom = room; gNoise = 0;
        if (room >= 0) hintOnce('shh' + room, 'Shh\u2026 crouch so you don\u2019t wake ' + (room === 1 ? 'it' : 'him') + '!', 3.2);
      }
      const s = room >= 0 ? sleepers[room] : null;
      hud.noise.classList.toggle('show', !!s && s.state === 'sleep');
      if (s && s.state === 'sleep') {
        const d = Math.hypot(p.x - s.x, p.z - s.z), near = clamp(1 - (d - 2) / 9, 0, 1);
        if (p.moving > .25 && !st.crouch) gNoise += dt * (.35 + 1.1 * near);
        else if (p.moving > .25 && d < 4.2) gNoise += dt * .12;
        else gNoise = Math.max(0, gNoise - dt * .22);
        if (gNoise > .55 && t - gStir > 2.5) { gStir = t; sfx.growl(.5); hintOnce('stir' + room, 'Shh\u2026! It\u2019s stirring\u2026', 1.8); }
        if (gNoise >= 1) { gNoise = 0; coop.sendAct('wake' + room); }
        hud.noiseBar.style.width = Math.min(100, gNoise * 100) + '%';
      }
    }
    // the player a sleeper goes for: whoever is in its room and closest
    function sleeperTarget(s) {
      let best = null, bd = 1e9;
      if (st.room === s.k && st.phase !== 'caught' && st.phase !== 'dead') { best = st.p; bd = Math.hypot(st.p.x - s.x, st.p.z - s.z); }
      if (coop) for (const g of coop.guests()) if (!g.dead && roomOf(g.x, g.z) === s.k) { const d = Math.hypot(g.x - s.x, g.z - s.z); if (d < bd) { bd = d; best = g; } }
      return best;
    }
    function updateMim(t, dt) {
      if (mm.state === 'hidden' || mm.state === 'gone') return;
      const p = st.p;
      mm.roar = lerp(mm.roar, mm.state === 'reveal' || mm.state === 'smash' || mm.state === 'hit' ? 1 : 0, Math.min(1, dt * 5));
      const head = mimHead(), gap = head[2] - p.z, dH = Math.hypot(p.x - head[0], p.z - head[2]);
      if (mm.state === 'reveal') {   // walks up to the back wall from her den, and through it
        const target = Z_BACK - 2.5 + M_HEAD; mm.z = Math.max(target, mm.z - (st.broken.back ? 3.2 : 1.9) * dt); mm.run = lerp(mm.run, .5, dt * 3); mm.ph += dt * 5;
        mm.rear = lerp(mm.rear, t - st.leverT > 2.2 && t - st.leverT < 3.4 ? 1 : 0, Math.min(1, dt * 4));
      } else if (mm.state === 'wait') {
        mm.run = lerp(mm.run, 0, dt * 4); mm.rear = lerp(mm.rear, 0, dt * 4);
        if (t > mm.resumeT) { mm.state = 'chase'; sfx.roar(1.2); }
      } else if (mm.state === 'smash') {
        mm.run = lerp(mm.run, 0, dt * 5); const k = t - mm.smashT;
        mm.rear = k < .7 ? smooth(0, .6, k) : 1 - smooth(.7, 1.0, k);
        if (k > .75 && !st.broken[mm.smashKey]) breakWall(mm.smashKey);
        if (k > (mm.smashKey === 'w2' ? 2.3 : 1.15)) mm.state = 'chase';
        if (mm.smashKey === 'w2' && k > 1.0 && k < 1.05) sfx.roar(1.3);
        if (mm.smashKey === 'w2' && k > 1.0) mm.rear = Math.max(mm.rear, .6 * (1 - smooth(1.8, 2.3, k)));
      } else if (mm.state === 'chase') {
        let sp = gap > 20 ? 7.2 : gap > 13 ? 5.6 : gap > 8 ? 4.6 : 3.9;
        const inRoom = mimInRoom();
        if (inRoom) sp = 2.8;
        if (st.phase !== 'chase') sp = 0;
        // she always heads for you: turn towards you (only so far in the narrow junkyard), and back up if you got behind her
        const lf = (p.x - mm.x) * Math.sin(mm.yaw) + (p.z - mm.z) * Math.cos(mm.yaw);
        const want = Math.atan2(p.x - mm.x, p.z - mm.z), lim = inRoom ? 3.2 : .45;
        mm.yaw = lerpAngle(mm.yaw, Math.PI + clamp(((want - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -lim, lim), Math.min(1, dt * (inRoom ? 1.5 : 2)));
        const dir = lf < -M_HALF * .3 ? -.6 : 1;
        mm.x += Math.sin(mm.yaw) * sp * dt * dir; mm.z += Math.cos(mm.yaw) * sp * dt * dir;
        const hw = inRoom ? LAS.x1 - 4 : C3W - 4.6; mm.x = clamp(mm.x, -hw, hw);
        if (inRoom) mm.z = Math.max(mm.z, GUN.muzzle + 3 + M_HEAD);   // never climbs onto the gun
        mm.run = lerp(mm.run, sp > 0 ? 1 : 0, Math.min(1, dt * 4)); mm.ph += dt * Math.PI * 2 * sp / 7.5; mm.rear = lerp(mm.rear, 0, dt * 4);
        for (const [key, z] of [['w1', Z_W1], ['w2', Z_W2]]) if (!st.broken[key] && head[2] < z + 1.2) { mm.state = 'smash'; mm.smashT = t; mm.smashKey = key; mm.z = z + 1.2 + M_HEAD; sfx.roar(1.1); }
        const vol = clamp(2.2 / (1 + Math.max(0, gap) * .12), 0, 1);
        if (sp > 0 && t > mm.stepT) { mm.stepT = t + 7.5 / sp / 4; sfx.thud(); sfx.step(vol); shake(.012 * vol, .25); }
        if (t > mm.growlT) { mm.growlT = t + 2.4 + Math.random() * 2; sfx.growl(vol); }
        if (st.phase === 'chase') {   // caught if you are anywhere under her body or right in front of her face
          const f = (p.x - mm.x) * Math.sin(mm.yaw) + (p.z - mm.z) * Math.cos(mm.yaw), l = (p.x - mm.x) * Math.cos(mm.yaw) - (p.z - mm.z) * Math.sin(mm.yaw);
          if ((f > -M_HALF && f < M_HEAD + 1.6 && Math.abs(l) < M_W + .3) || dH < 3) caught('mim');
        }
        if (st.armed && st.fireT < 0 && mimInRoom()) fireGun();
      } else if (mm.state === 'hit') {
        mm.run = lerp(mm.run, 0, dt * 6); mm.rear = .5 + Math.sin(t * 18) * .15; mm.glow = smooth(mm.hitT, mm.hitT + 1.2, t);
      }
    }
    function updateSleepers(t, dt) {
      if (st.p.z > Z_W2 - WT) return;   // the sleepers load in the background; only build them once you reach the laser room
      for (const s of sleepers) {
        const R = ensureSleeper(s.key); if (!R) continue;
        const p = st.p, tg = sleeperTarget(s) || p, dx = tg.x - s.x, dz = tg.z - s.z, d = Math.hypot(dx, dz);
        s.animT += dt;
        if (s.state === 'sleep') {
          if (st.room === s.k && t > s.snoreT) { s.snoreT = t + 3.3; sfx.snore(clamp(1.4 / (1 + d * .25), 0, 1)); }
        } else if (s.state === 'rise') {
          s.lie = 1 - smooth(s.t0, s.t0 + 1.0, t); s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3));
          if (t - s.t0 > 1.0) { s.state = 'roar'; s.t0 = t; s.animT = 0; sfx.roar(1.3); shake(.05, 1); }
        } else if (s.state === 'roar') {
          s.roar = lerp(s.roar, 1, dt * 6); s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
          if (t - s.t0 > 1.0) { s.state = 'chase'; s.animT = 0; }
        } else if (s.state === 'chase') {
          s.roar = lerp(s.roar, 0, dt * 4);
          const inRoom = sleeperTarget(s) !== null;
          const sp = inRoom ? 4.6 : 0, reach = 2.6 + R.halfD * .3;
          if (inRoom && d > reach * .8) { const k = Math.min(1, sp * dt / d); s.x += dx * k; s.z += dz * k; }
          s.x = clamp(s.x, -SL.hw + 1.5, SL.hw - 1.5); const Rm = ROOMS[s.k]; s.z = clamp(s.z, Rm.zBot + 1.5, Rm.zTop - 1.5);
          s.yaw = lerpAngle(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6)); s.run = lerp(s.run, sp > 0 ? 1 : 0, dt * 4); s.ph += dt * Math.PI * 2 * sp / 3.2;
          if (sp > 0 && t > s.stepT) { s.stepT = t + .38; sfx.step(.9); }
          if (tg === p && inRoom && st.phase === 'free' && d < reach && p.z > Rm.zBot) caught(s);
        }
      }
    }
    function updateBits(t, dt) {
      const phys = (b, floorY) => {
        if (b.rest) return;
        b.v[1] -= 20 * dt; for (let i = 0; i < 3; i++) { b.p[i] += b.v[i] * dt; b.r[i] += b.w[i] * dt; }
        const half = (b.s.length ? b.s[1] : b.s) / 2;
        if (b.p[1] < floorY + half) { b.p[1] = floorY + half; b.v[1] *= -.25; b.v[0] *= .5; b.v[2] *= .5; b.w = b.w.map(w => w * .5); if (Math.abs(b.v[1]) < .8) b.rest = true; }
      };
      for (const c of chunks) phys(c, 0); for (const c of debris) phys(c, 0);
      for (const f of fires) { if (t > f.t0) for (let i = 0; i < 3; i++) f.p[i] += f.v[i] * dt * .5; }
      for (let i = fires.length - 1; i >= 0; i--) if (t - fires[i].t0 > fires[i].life) fires.splice(i, 1);
    }

    /* ---- camera ---- */
    function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
    function lookAtYP(eye, tgt) { const dx = tgt[0] - eye[0], dz = tgt[2] - eye[2]; return [Math.atan2(dx, -dz), Math.atan2(tgt[1] - eye[1], Math.hypot(dx, dz))]; }
    function updateCamera(t, dt) {
      const p = st.p; let eye, yaw, pitch;
      const eyeH = lerp(1.62, .85, st.crouchK);
      if (st.phase === 'wake') {
        const k = t - st.wakeT;
        eye = [p.x, lerp(.3, 1.62, smooth(2.4, 4.6, k)), p.z];
        if (lookId === null) { st.dragYaw *= .99; st.dragPitch *= .99; }
        yaw = st.dragYaw; pitch = clamp(lerp(1.1, -.04, smooth(1.6, 4.4, k)) + st.dragPitch, -1.2, 1.4);
        if (k > 4.8 && !G) { st.camYaw = yaw; st.camPitch = pitch; st.eye = eye; beginExplore(); }
      } else if (st.phase === 'alarm') {
        const k = t - st.leverT; eye = [p.x, p.y + 1.62, p.z];
        const back = smooth(.9, 1.8, k) * (1 - smooth(3.8, 4.4, k));
        yaw = lerpAngle(st.turnFrom, Math.PI, back); if (k > 3.8) yaw = lerpAngle(Math.PI, 0, smooth(3.8, 4.4, k));
        pitch = lerp(st.pitchFrom, .2 * back, smooth(.9, 1.8, k));
      } else if (st.phase === 'firing') {
        eye = [p.x, p.y + eyeH, p.z]; const yp = lookAtYP(eye, [mm.x, 4.5, mm.z - M_HEAD * .6]);
        yaw = lerpAngle(st.camYaw, yp[0], Math.min(1, dt * 4)); pitch = lerp(st.camPitch, yp[1], Math.min(1, dt * 4));
      } else if (st.phase === 'caught' || st.phase === 'dead') {
        eye = [p.x, p.y + eyeH, p.z];
        let tgt;
        if (st.caughtBy === 'mim') tgt = mimHead();
        else { const s = st.caughtBy, R = sleeperRig[s.key]; tgt = [s.x, R ? R.halfH * 1.6 : 4, s.z]; }
        const yp = lookAtYP(eye, tgt); yaw = lerpAngle(st.camYaw, yp[0], Math.min(1, dt * 10)); pitch = lerp(st.camPitch, clamp(yp[1], -1, 1.2), Math.min(1, dt * 8));
      } else {
        eye = [p.x, p.y + eyeH + Math.sin(p.bob * 2) * (st.crouch ? .015 : .04) * p.moving, p.z]; yaw = p.yaw; pitch = p.pitch;
      }
      const sk = st.shk.amp * Math.max(0, 1 - (t - st.shk.t0) / st.shk.dur);
      if (sk > 0) eye = [eye[0] + Math.sin(t * 53) * sk, eye[1] + Math.sin(t * 61) * sk, eye[2] + Math.sin(t * 47) * sk * .6];
      st.eye = eye; st.camYaw = yaw; st.camPitch = pitch;
    }

    /* ---- lights ---- */
    const LIGHTS = [];
    C3_LAMPS.forEach(([x, z], i) => LIGHTS.push({ kind: 'lamp', i, p: [x, C3H - .8, z], r: 34 }));
    LIGHTS.push({ kind: 'den', p: [0, 6, Z_BACK + 12], r: 24 });
    LIGHTS.push({ kind: 'las', p: [-8, LAS.h - 1, -104], r: 34 }, { kind: 'las', p: [8, LAS.h - 1, -122], r: 34 }, { kind: 'gun', p: [0, GUN.y + 2.5, GUN.z + 9], r: 22 }, { kind: 'console', p: [CONSOLE[0], 2.2, CONSOLE[2] + .8], r: 4 });
    ROOMS.forEach(R => LIGHTS.push({ kind: 'room', p: [0, SL.h - .6, (R.zTop + R.zBot) / 2], r: 24 }));
    const Lpos = new Float32Array(24), Lcol = new Float32Array(24), Lrange = new Float32Array(8); let Ln = 0, am = 0, pulse = 0, flick = 1;
    const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const sc3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    function updateLights(t) {
      am = st.alarmT < 0 ? 0 : smooth(st.alarmT, st.alarmT + .5, t);
      pulse = .5 + .5 * Math.sin(t * 6.5); flick = (Math.sin(t * 29) > .95 || (t % 5.3) < .08) ? .25 : 1;
      const cand = [];
      for (const L of LIGHTS) {
        let c;
        if (L.kind === 'lamp') c = sc3(mix3(sc3([2.4, 2.1, 1.7], L.i === 3 ? flick : 1), sc3([2.6, .1, .06], .35 + .65 * pulse), am * .8), 16);
        else if (L.kind === 'den') c = st.broken.back ? [14, 2, 1.6] : [0, 0, 0];
        else if (L.kind === 'las') c = sc3(mix3([1.3, 1.6, 2.4], sc3([2.4, .1, .06], .35 + .65 * pulse), am * .6), 14);
        else if (L.kind === 'gun') c = sc3([.4, 1.8, 2.6], 5 * (st.charge / 6 + (st.fireT >= 0 && t - st.fireT < 1.4 ? 3 : 0)));
        else if (L.kind === 'console') c = st.cp === 'laser' && !st.armed ? [1.6, .3, .15] : [.2, 1.2, .4];
        else c = [17, 15, 24];
        const d = Math.hypot(L.p[0] - st.eye[0], L.p[1] - st.eye[1], L.p[2] - st.eye[2]);
        if (d > 70 || c[0] + c[1] + c[2] < .02) continue;
        cand.push({ L, c, s: d - L.r * .5 });
      }
      for (const f of fires) { const k = t - f.t0; if (k < 0) continue; const e = Math.max(0, 1 - k / f.life); cand.push({ L: { p: f.p, r: 18 + f.size * 2 }, c: [40 * e, 17 * e, 4.5 * e], s: -10 + k }); }
      if (st.fireT >= 0 && t - st.fireT < 1.4) cand.push({ L: { p: [mm.x * .5, 6, (GUN.muzzle + mm.z - M_HEAD) / 2], r: 36 }, c: [12, 32, 48], s: -20 });
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
      if (G) { const T = coop.time(t); if (T === null) return; t = T; }
      const dt = clamp(t - st.t, 0, .1); st.t = t;
      mouse.update();
      if (!noDraw && dt > 0) { emaDt = lerp(emaDt, dt, .05); if (t - lastScaleT > 1.5 && emaDt > .036 && resScale > .55) { resScale *= .85; lastScaleT = t; } }
      if (G) coop.apply(t);
      else for (let n = 0; n < 50; n++) { let k = -1; for (let i = 0; i < st.timers.length; i++) if (t >= st.timers[i].at && (k < 0 || st.timers[i].at < st.timers[k].at)) k = i; if (k < 0) break; const f = st.timers[k].fn; st.timers.splice(k, 1); f(); }   // earliest first, even on a slow frame
      if (st.toastUntil && t > st.toastUntil) { hud.toast.classList.remove('show'); st.toastUntil = 0; }
      updatePlayer(t, dt);
      if (!G) { updateMim(t, dt); updateSleepers(t, dt); }
      updateBits(t, dt);
      if (!(G && coop.cutscene())) updateCamera(t, dt); if (G) coop.camera(t, dt); updateLights(t);
      if (opts.mp) opts.mp.report(st.eye, st.camYaw, 1, st.crouch, st.phase === 'dead' || !!(G && coop.dead()));
      if (coop) coop.post(t, dt);
      sfx.siren(am * (st.p.z > Z_LR ? 1 : .3), t); sfx.setHum(.25);
      if (noDraw) return;

      resize();
      const asp = canvas.width / canvas.height, vfov = clamp(2 * Math.atan(Math.tan(31 * D) / asp), 58 * D, 92 * D);
      const eye = st.eye, yaw = st.camYaw, pitch = st.camPitch;
      const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const view = opts.debugCam ? M4.lookAt(opts.debugCam.eye, opts.debugCam.target, [0, 1, 0]) : M4.lookAt(eye, [eye[0] + fwd[0], eye[1] + fwd[1], eye[2] + fwd[2]], [0, 1, 0]);
      const VP = M4.mul(M4.persp(vfov, asp, .05, 260), view), camPos = opts.debugCam ? opts.debugCam.eye : eye;
      const inRooms = eye[2] < Z_LR;
      const amb = inRooms ? [.09, .08, .12] : mix3([.13, .125, .13], sc3([.22, .03, .02], .7 + .3 * pulse), am);
      const fogC = inRooms ? [.008, .006, .012] : mix3([.012, .012, .014], [.06, .005, .004], am);
      const fogD = inRooms ? .045 : .022;

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
      draw(M.floor, [.62, .6, .57], { tex: texFloor, spec: .25, shine: 30 });
      draw(M.wall, [.7, .72, .74], { tex: texWall, spec: .05 });
      draw(M.ceil, [.25, .25, .26], { tex: texFloor });
      if (!st.broken.back) draw(M.brk, [.7, .72, .74], { tex: texWall, spec: .05 });
      if (!st.broken.w1) draw(M.w1, [.7, .72, .74], { tex: texWall, spec: .05 });
      if (!st.broken.w2) draw(M.w2, [.7, .72, .74], { tex: texWall, spec: .05 });
      draw(M.dark, [.08, .07, .07], { tex: texFloor });
      draw(M.metal, [.24, .25, .27], { spec: .9, shine: 48 });
      draw(M.rust, [.36, .2, .1], { tex: texFloor, spec: .3, shine: 26 });
      draw(M.wood, [.55, .38, .22], { tex: texFloor });
      draw(M.crate, [.62, .45, .26], { tex: texFloor, spec: .1 });
      draw(M.pipe, [.3, .32, .3], { spec: 1, shine: 50 });
      draw(M.hazard, [1, 1, 1], { tex: texHaz, spec: .2 });
      draw(M.lamp, [.06, .06, .06], { spec: .3 });
      draw(M.tube, [0, 0, 0], { em: mix3([2.4, 2.3, 2.0], [2.6, .12, .06], am * .8) });
      draw(M.lasWall, [.5, .55, .62], { tex: texWall, spec: .1 });
      draw(M.gun, [.35, .4, .46], { spec: 1.1, shine: 60 });
      draw(M.gunDark, [.09, .1, .12], { spec: .8, shine: 40 });
      draw(M.room, [.42, .38, .5], { tex: texWall, spec: .05 });
      draw(M.roomFloor, [.42, .36, .32], { tex: texFloor, spec: .2 });
      draw(M.tunnel, [.25, .24, .24], { tex: texFloor });
      ringMs.forEach((m, i) => draw(m, [.1, .12, .14], { spec: 1, shine: 60, em: i < st.charge ? sc3([.4, 1.7, 2.6], .8 + .4 * Math.sin(t * 9 + i)) : [0, 0, 0] }));
      // the console button
      draw(cubeM, [.25, .03, .02], { em: st.cp === 'laser' && !st.armed ? [1.8 * (.6 + .4 * pulse), .08, .04] : [.1, 1.2, .35], spec: 1, model: M4.trs([CONSOLE[0], 1.14, CONSOLE[2] + .1], [0, 0, 0, 1], [.34, .1, .34]) });
      for (let i = 0; i < 6; i++) draw(cubeM, [.05, .05, .05], { em: i < st.charge ? [.3, 1.6, 2.4] : [.05, .05, .06], model: M4.mul(M4.trs([CONSOLE[0] - .4 + i * .16, 1.48, CONSOLE[2] - .27], Q.aa(1, 0, 0, -.35), [1, 1, 1]), M4.trs([0, 0, 0], [0, 0, 0, 1], [.11, .18, .02])) });
      // lever
      const lk = st.leverT < 0 ? 0 : smooth(st.leverT, st.leverT + .35, t);
      draw(leverM, [.6, .08, .05], { spec: .8, model: M4.trs([LEVER[0], 1.0, LEVER[2]], Q.aa(1, 0, 0, lerp(-.7, .7, lk)), [1, 1, 1]) });
      // the vent cover
      if (!st.broken.grate) draw(grateM, [.3, .32, .34], { spec: .8, model: M4.trs([LAS_HOLE_X, 0, Z_LR + .05], [0, 0, 0, 1], [1, 1, 1]) });
      else { const k = smooth(st.grateT, st.grateT + .45, t); draw(grateM, [.3, .32, .34], { spec: .8, model: M4.trs([LAS_HOLE_X, .04 * k, Z_LR + .05 + k * .2], Q.aa(1, 0, 0, k * Math.PI / 2), [1, 1, 1]) }); }
      for (const c of chunks) draw(cubeM, [.66, .66, .68], { tex: texWall, model: M4.trs(c.p, Q.euler(c.r[0], c.r[1], c.r[2]), c.s) });
      for (const c of debris) draw(cubeM, [.35, .38, .85], { spec: .4, model: M4.trs(c.p, Q.euler(c.r[0], c.r[1], c.r[2]), [c.s, c.s, c.s]) });
      // the laser beam core
      if (st.fireT >= 0 && t - st.fireT < 1.4) {
        const a = [0, GUN.y, GUN.muzzle], b = mimHead(); b[1] = 4.6; const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
        const w = .35 * (1 - smooth(1.1, 1.4, t - st.fireT)) * smooth(0, .12, t - st.fireT);
        draw(cylM, [0, 0, 0], { em: [3, 4, 4.5], model: M4.trs(a, Q.mul(Q.aa(0, 1, 0, Math.atan2(dx, dz)), Q.aa(1, 0, 0, Math.asin(clamp(-dy / L, -1, 1)))), [w, w, L]) });
      }

      // characters
      common(progS); gl.uniform1i(progS.u.uFlip, 1);
      if (mm.state !== 'hidden' && mm.state !== 'gone') {
        mim.setPose(mim.worldDeltas(mimSpec(mm.run, mm.ph, mm.roar)));
        const bob = Math.abs(Math.sin(mm.ph)) * .35 * mm.run;
        const model = M4.mul(M4.mul(M4.trs([mm.x, bob, mm.z], Q.aa(0, 1, 0, mm.yaw), [1, 1, 1]), M4.trs([0, 0, -M_HALF], Q.aa(1, 0, 0, -mm.rear * .26), [1, 1, 1])),
          M4.trs([0, 0, M_HALF], [0, 0, 0, 1], [MS, MS, MS]));
        mim.draw(progS, M4.mul(model, M4.trs([-M_CTR[0], -M_CTR[1], -M_CTR[2]], [0, 0, 0, 1], [1, 1, 1])), { spec: { Body: [.45, 30], material: [1.4, 70], Pupils: [1.5, 80], Collar: [.8, 40], Buckle: [1.2, 60] }, emissive: mm.glow > 0 ? { Body: sc3([.6, 1.6, 2.4], mm.glow), material: sc3([.6, 1.6, 2.4], mm.glow), Collar: sc3([.6, 1.6, 2.4], mm.glow) } : null });
      }
      for (const s of sleepers) {
        const R = sleeperRig[s.key]; if (!R) continue;
        const dz = s.z - eye[2]; if (Math.abs(dz) > 40) continue;
        const rig = R.rig, cl = R.clips;
        if (s.state === 'sleep' || s.state === 'rise') { if (cl.idle) rig.setAnim([['idle', s.animT * .35, 1]]); else rig.setPose(null); }
        else if (s.state === 'roar') { if (cl.roar) rig.setAnim([['roar', s.animT, 1, true]]); else if (BIPED[s.key]) rig.setPose(rig.worldDeltas(bipedSpec(BIPED[s.key], 0, 0, 1))); else if (cl.idle) rig.setAnim([['idle', s.animT * 2, 1]]); else rig.setPose(null); }
        else { if (cl.walk) rig.setAnim([['walk', s.ph / (Math.PI * 2) * cl.walk.dur, 1]]); else if (BIPED[s.key]) rig.setPose(rig.worldDeltas(bipedSpec(BIPED[s.key], s.run, s.ph, s.roar))); else rig.setPose(null); }
        const breath = s.state === 'sleep' ? 1 + .035 * Math.sin(t * 1.5 + s.k) : 1;
        const lift = lerp(R.halfH, R.halfW, s.lie) * breath + (BIPED[s.key] || cl.walk ? 0 : Math.abs(Math.sin(s.ph)) * .25 * s.run);
        const twitch = t - s.stirT < .8 ? Math.sin(t * 30) * .04 : 0;
        const model = M4.mul(M4.mul(M4.trs([s.x, lift, s.z], Q.mul(Q.aa(0, 1, 0, s.yaw + twitch), Q.aa(0, 0, 1, s.lie * Math.PI / 2)), [1, breath, 1]), M4.trs([0, 0, 0], [0, 0, 0, 1], [R.sc, R.sc, R.sc])), M4.trs([-R.ctr[0], -R.ctr[1], -R.ctr[2]], [0, 0, 0, 1], [1, 1, 1]));
        rig.draw(progS, model, {});
      }
      gl.useProgram(progW.p);
      if (mpAv) { gl.uniform1i(progW.u.uMode, 0); mpAv.draw(progW, VP, t, dt, controlling() ? opts.mp.peers() : [], 1, camPos); }

      // glows (additive)
      gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE); gl.uniform1i(progW.u.uUseTex, 0);
      gl.uniform1i(progW.u.uMode, 2); gl.bindVertexArray(sprite.vao);
      const glow = (p, size, c, a) => {
        if (a <= .01) return; const dx = camPos[0] - p[0], dz = camPos[2] - p[2]; if (dx * dx + dz * dz > 22500) return;
        gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs(p, Q.aa(0, 1, 0, Math.atan2(dx, dz)), [size, size, size]));
        gl.uniform3fv(progW.u.uColor, c); gl.uniform1f(progW.u.uAlpha, a); gl.drawElements(gl.TRIANGLES, sprite.count, sprite.type, 0);
      };
      C3_LAMPS.forEach(([x, z], i) => glow([x, C3H - .5, z], 3.2, mix3([1, .9, .75], [1, .06, .03], am * .8), (i === 3 ? flick : 1) * .6));
      for (let i = 0; i < st.charge; i++) glow([0, GUN.y + 1.6, GUN.z + 4.2 + i * 2.1], 2.2, [.3, .8, 1], .5);
      if (st.charge > 0 && st.fireT < 0) glow([0, GUN.y, GUN.muzzle + .2], 1.5 + st.charge * .6, [.4, .9, 1], .35 + .1 * st.charge + .2 * Math.sin(t * 20));
      glow([CONSOLE[0], 1.25, CONSOLE[2] + .15], .9, st.cp === 'laser' && !st.armed ? [1, .1, .05] : [.1, 1, .3], .7);
      if (st.phase === 'explore') glow([LEVER[0], 1.1, LEVER[2] + .35], 1.0, [1, .7, .1], .5 * pulse);
      if (st.fireT >= 0 && t - st.fireT < 1.4) {
        const k = t - st.fireT, a = [0, GUN.y, GUN.muzzle], b = mimHead(); b[1] = 4.6; const e = smooth(0, .1, k) * (1 - smooth(1.1, 1.4, k));
        for (let i = 0; i <= 30; i++) { const u = i / 30; glow([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], 2.4 + Math.sin(t * 40 + i) * .4, [.35, .8, 1], .8 * e); }
        glow(a, 6, [.6, .9, 1], e); glow(b, 9, [.7, .95, 1], e);
      }
      for (const f of fires) { const k = t - f.t0; if (k < 0) continue; const e = Math.max(0, 1 - k / f.life); glow(f.p, f.size * (.7 + k * 1.4), [1, .3 + .4 * e, .08 + .2 * e], 1.3 * e); glow(f.p, f.size * .5, [1, .85, .55], 1.5 * e * e); }
      // Zzz above the sleepers
      gl.uniform1i(progW.u.uMode, 5); gl.uniform1i(progW.u.uUseTex, 1); gl.bindTexture(gl.TEXTURE_2D, texZ);
      for (const s of sleepers) {
        if (s.state !== 'sleep' || Math.abs(s.z - eye[2]) > 30) continue; const R = sleeperRig[s.key]; if (!R) continue;
        for (let i = 0; i < 3; i++) {
          const k = ((t * .45 + i / 3) % 1), hx = s.x - Math.cos(s.yaw) * R.halfH * .7, hz = s.z + Math.sin(s.yaw) * R.halfH * .7;
          const p = [hx + Math.sin(k * 6 + i) * .4, R.halfW * 2 + .3 + k * 2.2, hz], dx = camPos[0] - p[0], dz2 = camPos[2] - p[2], sz = .4 + k * .5;
          gl.uniform3fv(progW.u.uColor, sc3([1, 1, 1], Math.sin(Math.PI * k) * (st.noise > .55 && st.room === s.k ? .3 : 1)));
          gl.uniformMatrix4fv(progW.u.uModel, false, M4.trs(p, Q.aa(0, 1, 0, Math.atan2(dx, dz2)), [sz, sz, sz])); gl.drawElements(gl.TRIANGLES, sprite.count, sprite.type, 0);
        }
      }
      gl.uniform1i(progW.u.uMode, 0); gl.uniform1i(progW.u.uUseTex, 0); gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
    }

    let t0 = performance.now();
    function loop(now) { if (!alive) return; frame((now - t0) / 1000); raf = requestAnimationFrame(loop); }
    hud.lids.classList.add('on');
    if (opts.debugSetup) opts.debugSetup(st, { beginExplore, pullLever, breakWall, chargeGun, fireGun, wakeSleeper, caught, respawn, finish, toggleCrouch, setCrouch, onAct, mm, sleepers, ensureSleeper, chunks, later, mimHead });
    if (opts.debugTime !== undefined) { const T0 = opts.debugFrom || 0; st.t = T0; for (let t = T0; t <= opts.debugTime; t += 1 / 30) frame(t, t + 1 / 30 <= opts.debugTime); }
    else { t0 = performance.now() - (opts.debugFrom || 0) * 1000; st.t = opts.debugFrom || 0; raf = requestAnimationFrame(loop); }

    return {
      stop() {
        alive = false; cancelAnimationFrame(raf); sfx.stop();
        hud.zone.removeEventListener('pointerdown', onZoneDown); canvas.removeEventListener('pointerdown', onCanvasDown);
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
        for (const el of [A.borrowed]) if (el) { try { el.pause(); } catch (e) {} }
        mouse.stop(); hud.root.remove(); if (mpAv) mpAv.dispose();
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      },
      state: st, mm, sleepers, coop, _frame: (t, nd) => frame(t, nd)
    };
  }

  window.Chapter3 = { start: startC3, _internals: { makeRig, M4, Q, mimSpec, bipedSpec } };
})();
