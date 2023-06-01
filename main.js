'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let background;                 // A background model
let video;                      // Object holding video stream from camera
let stereoCam;                  // Object holding stereo camera calculation parameters
let textureWebCam;              // Texture to optimize convertation from png to bmp and so on
let texture_object;             // Texture object holds a texture of type gl.TEXTURE_2D for surface
let audioContext;
let sourceNode;
let pannerNode;
let audioElement;
let playButton;
let listener;

let point = { u: 200, v: 200 };

let b = 3
let c = 2
let d = 4

let X = (u, v) => (0.05 * (f(a, b, v) * (1 + Math.cos(u) + (d ** 2 - c ** 2) * ((1 - Math.cos(u)) / f(a, b, v)))) * Math.cos(v));
let Y = (u, v) => (0.05 * (f(a, b, v) * (1 + Math.cos(u) + (d ** 2 - c ** 2) * ((1 - Math.cos(u)) / f(a, b, v)))) * Math.sin(v));
let Z = (u, v) => (0.05 * (f(a, b, v) - (d ** 2 - c ** 2) / f(a, b, v)) * Math.sin(u));

function f(a, b, j) {
  return ((a * b) / (Math.sqrt(a ** 2 * Math.sin(j) ** 2 + b ** 2 * Math.cos(j) ** 2)))
}

function deg2rad(angle) {
  return angle * Math.PI / 180;
}

let pValue = 0;
const getCircleCords = () => {
  const p = Math.sin(pValue) * 2.5;
  return [p, 10, (-10 + (p * p))];
}

function StereoCamera(
  Convergence,
  EyeSeparation,
  AspectRatio,
  FOV,
  NearClippingDistance,
  FarClippingDistance
) {
  this.mConvergence = Convergence;
  this.mEyeSeparation = EyeSeparation;
  this.mAspectRatio = AspectRatio;
  this.mFOV = FOV;
  this.mNearClippingDistance = NearClippingDistance;
  this.mFarClippingDistance = FarClippingDistance;
  this.mProjectionMatrix;
  this.mModelViewMatrix;

  this.ApplyLeftFrustum = function () {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-b * this.mNearClippingDistance) / this.mConvergence;
    right = (c * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);

    // Displace the world to right
    this.mModelViewMatrix = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0);
  };

  this.ApplyRightFrustum = function () {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-c * this.mNearClippingDistance) / this.mConvergence;
    right = (b * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);

    // Displace the world to left
    this.mModelViewMatrix = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0);
  };
}

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iNormalsBuffer = gl.createBuffer();
  this.iTextureBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function ({ vertexList, normalsList, textureList }) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalsBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalsList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureList), gl.STATIC_DRAW);

    this.count = vertexList.length / 3;
  }

  this.Draw = function () {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalsBuffer);
    gl.vertexAttribPointer(shProgram.iNormalsVertex, 3, gl.FLOAT, true, 0, 0);
    gl.enableVertexAttribArray(shProgram.iNormalsVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.enableVertexAttribArray(shProgram.iTextureCoords);
    gl.vertexAttribPointer(shProgram.iTextureCoords, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
}

// Constructor
function ShaderProgram(name, program) {

  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  this.iNormalsVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;
  this.iViewWorldPosition = -1;

  this.iWMatrix = -1;
  this.iWInverseTranspose = -1;

  this.iLightWorldPosition = -1;
  this.iLightDir = -1;

  this.iTextureCoords = -1;
  this.iTMU = -1;

  this.iFScale = -1;
  this.iFPoint = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  }
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
// let tempview;
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();
  // if (!tempview) { tempview = modelView }
  // console.log("modelView : " + modelView)




  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -10);

  let matAccumRotate0 = m4.multiply(rotateToPointZero, modelView);
  let matAccumTrans0 = m4.multiply(translateToPointZero, matAccumRotate0);

  //CGW
    let modelViewProjectionSphere = m4.multiply(matAccumRotate0,  moveModelCGWRotationMatrix(calculateSurfaceRotation()));
    console.log("modelViewProjectionSphere: " + modelViewProjectionSphere)
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjectionSphere);
    sphere.Draw();
  //CGW
  
  // correct positioning of webcam texture
  let rotateToCenter = m4.axisRotation([0.0, 0.0, 1.0], Math.PI);
  let translateToCenter = m4.translation(2, 2, -10);
  let enlargedBackground = m4.scaling(4, 4.5, 1);

  // An identity matrix is a matrix that effectively represents 1.0
  // so that if you multiply by the identity nothing happens
  let matAccumIdent = m4.multiply(rotateToCenter, m4.identity());
  let matAccumEnlarge = m4.multiply(enlargedBackground, matAccumIdent);
  let matAccumView = m4.multiply(translateToCenter, matAccumEnlarge);

  /* Multiply the projection matrix times the modelview matrix to give the
     combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccumTrans0);

  let worldInverseMatrix = m4.inverse(matAccumTrans0); // possible //no effect
  let worldInverseTransposeMatrix = m4.transpose(worldInverseMatrix);

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumView); //possible // very likely ?
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);

  gl.uniform3fv(shProgram.iViewWorldPosition, [0, 0, 0]);
  gl.uniform3fv(shProgram.iLightWorldPosition, getCircleCords());
  gl.uniform3fv(shProgram.iLightDir, [0, -1, 0]);

  gl.uniformMatrix4fv(shProgram.iWInverseTranspose, false, worldInverseTransposeMatrix); // possible
  gl.uniformMatrix4fv(shProgram.iWMatrix, false, matAccumTrans0);// possible

  /* Draw the six faces of a cube, with different colors. */
  gl.uniform4fv(shProgram.iColor, [1, 1, 1, 1]);

  const scaleU = 1; //document.getElementById('textureScaleU').value;  // To disfunction sliders 
  const scaleV = 1; //document.getElementById('textureScaleV').value;
  // console.log(scaleU, scaleV, point)
  gl.uniform2fv(shProgram.iFScale, [scaleU, scaleV]);
  gl.uniform2fv(shProgram.iFPoint, [X(point.u, point.v), Y(point.u, point.v)]);

  gl.uniform1i(shProgram.iTMU, 0);

  // Set values from sliders to stereo camera
  stereoCam.mEyeSeparation = document.getElementById("eyeSeparation").value;
  stereoCam.mFOV = document.getElementById("fieldOfView").value;
  stereoCam.mNearClippingDistance = document.getElementById("nearClipping").value - 0.001; // Not sure why, but need to substract some value
  stereoCam.mConvergence = document.getElementById("Convergence").value;
  // Get projection matrixes for both eyes
  stereoCam.ApplyLeftFrustum();
  let projectionR = stereoCam.mProjectionMatrix;
  stereoCam.ApplyRightFrustum();
  let projectionL = stereoCam.mProjectionMatrix;

  // First bind and draw is for video from webcam
  gl.bindTexture(gl.TEXTURE_2D, textureWebCam);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.uniform1f(shProgram.iL, 0)
  background.Draw();
  gl.uniform1f(shProgram.iL, 10)
  // Need to call uniformMatrix4fv to correctly position and fix webcam texture.
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccumTrans0); //definetly not the best place for this line, but demonstration and convinient code reading is priority for now
  // Second bind and 2 draws is for surface texture for each eye (must be a better way)
  gl.bindTexture(gl.TEXTURE_2D, texture_object);

  // First pass for left eye, drawing blue+green (mask red)
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projectionL);
  gl.colorMask(true, false, false, false); //reference for colours - https://registry.khronos.org/OpenGL-Refpages/gl4/html/glColorMask.xhtml
  surface.Draw();

  // Second pass for the right eye, drawing red (mask blue+green)
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projectionR);
  gl.colorMask(false, true, true, false);
  surface.Draw();

  gl.colorMask(true, true, true, true);
}

function CreateSurfaceData() {
  const vertexList = [];
  const normalsList = [];
  const textureList = [];

  const dU = 0.001;
  const dV = 0.001;

  for (let u = diapazonUFrom; u <= diapazonUTo; u += step) {
    for (let v = diapazonVFrom; v <= diapazonVTo; v += step) {
      const u0 = u;
      const v0 = v;
      const u1 = u + step;
      // const v1 = v + step;

      let x0 = X(u0, v0);
      let y0 = Y(u0, v0);
      let z0 = Z(u0, v0);

      let xR = X(u1, v0);
      let yR = Y(u1, v0);
      let zR = Z(u1, v0);

      vertexList.push(x0, z0, y0);
      vertexList.push(xR, zR, yR);

      normalsList.push(...m4.cross(calcDerU(u0, v0, dU), calcDerV(u0, v0, dV)))
      normalsList.push(...m4.cross(calcDerU(u1, v0, dU), calcDerV(u1, v0, dV)));

      textureList.push(...calcTextureUV(u0, v0));
      textureList.push(...calcTextureUV(u1, v0));
    }
  }

  return { vertexList, normalsList, textureList };
}

const calcDerU = (u, v, dU) => ([
  (X(u + dU, v) - X(u, v)) / deg2rad(dU),
  (Y(u + dU, v) - Y(u, v)) / deg2rad(dU),
  (Z(u + dU, v) - Z(u, v)) / deg2rad(dU),
])

const calcDerV = (u, v, dV) => ([
  (X(u, v + dV) - X(u, v)) / deg2rad(dV),
  (Y(u, v + dV) - Y(u, v)) / deg2rad(dV),
  (Z(u, v + dV) - Z(u, v)) / deg2rad(dV),
])

const calcTextureUV = (u, v) => ([u / diapazonUTo, v / diapazonVTo]);


/* Initialize the WebGL context. Called from init() */
let prog;
function initGL() {
  prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iNormalsVertex = gl.getAttribLocation(prog, "normal");
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  shProgram.iWInverseTranspose = gl.getUniformLocation(prog, "wInverseTranspose");
  shProgram.iWMatrix = gl.getUniformLocation(prog, "wMatrix");

  shProgram.iViewWorldPosition = gl.getUniformLocation(prog, "ViewWorldPosition");
  shProgram.iLightWorldPosition = gl.getUniformLocation(prog, "LightWorldPosition");
  shProgram.iLightDir = gl.getUniformLocation(prog, "lightDir");
  shProgram.iL = gl.getUniformLocation(prog, "l");

  shProgram.iTextureCoords = gl.getAttribLocation(prog, 'textureCoords');
  shProgram.iTMU = gl.getUniformLocation(prog, 'tmu');

  shProgram.iFScale = gl.getUniformLocation(prog, 'fScale');
  shProgram.iFPoint = gl.getUniformLocation(prog, 'fPoint');

  surface = new Model('Surface');
  surface.BufferData(CreateSurfaceData());
  
  sphere = new Model('Sphere');
  sphere.BufferData(createSphere(1, 30, 30));

  stereoCam = new StereoCamera(// "If something doesn't work - try to change numbers a bit"
    2000,
    35.0,
    1.3,
    45.0,
    10.0,
    20000
  );

  // references - lection and https://developer.mozilla.org/ru/docs/Web/API/MediaDevices/getUserMedia
  // Set to global video variable (or define and initialize variable globally(not good for consistency)).
  video = document.createElement('video');
  var constraints = { video: true };
  navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = function (e) { // video.autoplay is shaggy, this approach is better(?)
      video.play();
    };
  }).catch(function (err) { console.log(err.name + ": " + err.message); });
  // always check for errors at the end.

  gl.enable(gl.DEPTH_TEST);

  // There is another way of doing this, but I failed when tried to implement.
  // reference - https://webglfundamentals.org/webgl/lessons/webgl-2d-drawimage.html
  background = new Model();
  background.BufferData({
    vertexList: [0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0],
    normalsList: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
    textureList: [1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]
  });

  CreateWebCamTexture();

  LoadTexture();

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();  // initialize the WebGL graphics context
    //    initGLSphere();
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);
  setInterval(draw, 1 / 20)
}

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case 'ArrowLeft':
      pValue -= 0.1;
      draw();
      break;
    case 'ArrowRight':
      pValue += 0.1;
      draw();
      break;
    case 'w':
      point.v = point.v + step;
      draw();
      break;
    case 's':
      point.v = point.v - step;
      draw();
      break;
    case 'd':
      point.u = point.u + step;
      draw();
      break;
    case 'a':
      point.u = point.u - step;
      draw();
      break;
    default:
      break;
  }
});

function LoadTexture() {
  // Use global object "texture object"
  texture_object = gl.createTexture();
  let image = new Image();
  image.src = 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?cs=srgb&dl=pexels-yurii-hlei-1545743.jpg&fm=jpg';
  image.crossOrigin = 'anonymous';

  image.onload = () => {
    // Make the "texture object" be the active texture object. Only the
    // active object can be modified or used. This also declares that the
    // texture object will hold a texture of type gl.TEXTURE_2D. The type
    // of the texture, gl.TEXTURE_2D, can't be changed after this initialization.
    gl.bindTexture(gl.TEXTURE_2D, texture_object);

    // Set parameters of the texture object. 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

    // Tell gl to flip the orientation of the image on the Y axis. Most
    // images have their origin in the upper-left corner. WebGL expects
    // the origin of an image to be in the lower-left corner.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    // Store in the image in the GPU's texture object
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    draw();
  };
}

// Create texture and assign to a global texture variable
function CreateWebCamTexture() {
  textureWebCam = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textureWebCam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}




// CGW
function createSphere(radius, latitudeBands, longitudeBands) {
  const positions = [];
  const indices = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = (lat * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let long = 0; long <= longitudeBands; long++) {
      const phi = (long * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
    }
  }

  for (let lat = 0; lat < latitudeBands; lat++) {
    for (let long = 0; long < longitudeBands; long++) {
      const first = lat * (longitudeBands + 1) + long;
      const second = first + longitudeBands + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  console.log("VertexList is: " + positions);
  return { vertexList: positions, normalsList: indices, textureList: null};
}


let sphereProg;
let sphere;
// function initGLSphere() {
//   sphereProg = createProgram(gl, vertexShaderSource, fragmentShaderSource);

//   let sphProgram = new ShaderProgram('Basic', sphereProg);
//   shpProgram.Use();

//   sphProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
//   sphProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
//   sphProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");

//   sphProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
//   sphProgram.iNormalsVertex = gl.getAttribLocation(prog, "normal");
//   sphProgram.iColor = gl.getUniformLocation(prog, "color");

//   sphProgram.iWInverseTranspose = gl.getUniformLocation(prog, "wInverseTranspose");
//   sphProgram.iWMatrix = gl.getUniformLocation(prog, "wMatrix");

//   sphProgram.iViewWorldPosition = gl.getUniformLocation(prog, "ViewWorldPosition");
//   sphProgram.iLightWorldPosition = gl.getUniformLocation(prog, "LightWorldPosition");
//   sphProgram.iLightDir = gl.getUniformLocation(prog, "lightDir");
//   sphProgram.iL = gl.getUniformLocation(prog, "l");

//   sphProgram.iTextureCoords = gl.getAttribLocation(prog, 'textureCoords');
//   sphProgram.iTMU = gl.getUniformLocation(prog, 'tmu');

//   sphProgram.iFScale = gl.getUniformLocation(prog, 'fScale');
//   sphProgram.iFPoint = gl.getUniformLocation(prog, 'fPoint');

//   sphere = new Model('Sphere');
//   sphere.BufferData(createSphere(1.0, 30, 30));

//   LoadTexture();

//   gl.enable(gl.DEPTH_TEST);
// }

// function drawSphere() {
//   const sphere = createSphere(1.0, 30, 30);

//   const positionBuffer = gl.createBuffer();
//   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.positions), gl.STATIC_DRAW);

//   const indexBuffer = gl.createBuffer();
//   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
//   gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphere.indices), gl.STATIC_DRAW);

//   const positionAttributeLocation = gl.getAttribLocation(prog, "vertex");
//   gl.enableVertexAttribArray(positionAttributeLocation);
//   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//   gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

//   gl.clearColor(0.0, 0.0, 0.0, 1.0);
//   gl.clear(gl.COLOR_BUFFER_BIT);
//   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

//   // gl.getUniformLocation

//   //
  // sphereProg
/*  const rotationMatrix = moveModelCGWRotationMatrix(calculateSurfaceRotation());
  const rotationUniformLocation = gl.getUniformLocation(sphereProg, "ModelViewMatrix");
  console.log("rotationUniformLocation in DrawSphere: " + rotationUniformLocation)
  gl.uniformMatrix4fv(rotationUniformLocation, false, rotationMatrix);
  //

  gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);
*/
// }

function moveModelCGWRotationMatrix(compassHeadingM){
  const centerX = 0;
  const centerY = 0;
  const centerZ = 0;
  
  // Define the radius of circular motion
  const radius = 0.75; // Adjust the radius as needed
  
  // Initialize the angle
  let angle = compassHeadingM;
  
  const objectX = centerX + Math.cos(angle) * radius;
  const objectY = centerY;
  const objectZ = centerZ + Math.sin(angle) * radius;
  
  if(pannerNode != undefined){
  pannerNode.setPosition(objectX, objectY, objectZ); // Update the position of the audio source
  pannerNode.setOrientation(0, 0, -1); // Set the orientation of the audio source
  pannerNode.distanceModel = 'linear'; // Change the distance model if needed
  }

  let rotationMatrix = new Float32Array([
    Math.cos(angle), 0, Math.sin(angle), 0,
    0, 1, 0, 0,
    -Math.sin(angle), 0, Math.cos(angle), 0,
    0, 0, 0, 1
  ]);
  
  let translateToCenter2 = m4.translation(objectX, objectZ, 0); //-10
  rotationMatrix =  m4.multiply(translateToCenter2, rotationMatrix)
  return rotationMatrix;
}

//PA2
function getRotationMatrix(alpha, beta, gamma) {

  var _x = beta; // beta value
  var _y = gamma; // gamma value
  var _z = alpha; // alpha value

  var cX = Math.cos(_x);
  var cY = Math.cos(_y);
  var cZ = Math.cos(_z);
  var sX = Math.sin(_x);
  var sY = Math.sin(_y);
  var sZ = Math.sin(_z);

  //
  // ZXY rotation matrix construction.
  //

  var m11 = cZ * cY - sZ * sX * sY;
  var m12 = - cX * sZ;
  var m13 = cY * sZ * sX + cZ * sY;

  var m21 = cY * sZ + cZ * sX * sY;
  var m22 = cZ * cX;
  var m23 = sZ * sY - cZ * cY * sX;

  var m31 = - cX * sY;
  var m32 = sX;
  var m33 = cX * cY;

  return [
    m11, m12, m13, 0,
    m21, m22, m23, 0,
    m31, m32, m33, 0, 0, 0, 0, 1
  ];

};
var degtorad = Math.PI / 180; // Degree-to-Radian conversion

function compassHeading( alpha, beta, gamma ) {

  var _x = beta  ? beta  * degtorad : 0; // beta value
  var _y = gamma ? gamma * degtorad : 0; // gamma value
  var _z = alpha ? alpha * degtorad : 0; // alpha value

  var cX = Math.cos( _x );
  var cY = Math.cos( _y );
  var cZ = Math.cos( _z );
  var sX = Math.sin( _x );
  var sY = Math.sin( _y );
  var sZ = Math.sin( _z );

  // Calculate Vx and Vy components
  var Vx = - cZ * sY - sZ * sX * cY;
  var Vy = - sZ * sY + cZ * sX * cY;

  // Calculate compass heading
  var compassHeading = Math.atan( Vx / Vy );

  // Convert compass heading to use whole unit circle
  if( Vy < 0 ) {
    compassHeading += Math.PI;
  } else if( Vx < 0 ) {
    compassHeading += 2 * Math.PI;
  }

  console.log("This is compassHeading() function. Return value: " + compassHeading * ( 180 / Math.PI ))
  return compassHeading * ( 180 / Math.PI ); // Compass Heading (in degrees)
}


// let accelerometerData;
// let surfaceRotation;
//It uses magnetometer data as well, and works, but I need ONLY magnetometer data.
// window.addEventListener('deviceorientation', (e) => {
//   magnetometerData = e;
//   // calculateSurfaceRotation();
// });
//60 times per second seems reasonable // turned out that NO - Maximum allowed frequency value for this sensor type is 10 Hz.
// reference: https://developer.mozilla.org/en-US/docs/Web/API/Magnetometer
let magnetometerData;
let magSensor = new Magnetometer({ frequency: 10 }); 
magSensor.addEventListener("reading", (e) => {
  console.log(`Magnetic field along the X-axis ${magSensor.x}`);
  console.log(`Magnetic field along the Y-axis ${magSensor.y}`);
  console.log(`Magnetic field along the Z-axis ${magSensor.z}`);
  const alpha = magSensor.x;
  const beta = magSensor.y;
  const gamma = magSensor.z;
  magnetometerData = [alpha, beta, gamma];
});
magSensor.start();
//// Just in case my variant is 1 and not 2
// // Event listener for accelerometer sensor readings
// window.addEventListener('devicemotion', (e) => {
//   accelerometerData = e;
//   // calculateSurfaceRotation();
// });

function calculateSurfaceRotation() {
  console.log("Its calculateSurfaceRotation function. magnetometerData = " + magnetometerData)
  if (magnetometerData != null) {
    // Calculate rotation
    let rotationData = compassHeading(magnetometerData[0], magnetometerData[1], magnetometerData[2]);
    console.log("Its calculateSurfaceRotation function. Rotation value: " + rotationData);

    return rotationData;
  }
}
