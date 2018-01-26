#include "laplacian_deformation.hpp"

#include <glad/glad.h>
#include <GLFW/glfw3.h>


#include <cstdlib>

#include <cstring>
#include <string>
#include <chrono>
#include <ctime>
#include <thread>
#include <algorithm>
#include <vector>

namespace demo {
	inline void CheckOpenGLError(const char* stmt, const char* fname, int line)
	{
		GLenum err = glGetError();
		if (err != GL_NO_ERROR) {
			printf("OpenGL error %08x, at %s:%i - for %s.\n", err, fname, line, stmt);
			exit(1);
		}
	}



#ifdef NDEBUG
	// helper macro that checks for GL errors.
#define GL_C(stmt) do {					\
	stmt;						\
    } while (0)
#else
	// helper macro that checks for GL errors.
#define GL_C(stmt) do {					\
	stmt;						\
	CheckOpenGLError(#stmt, __FILE__, __LINE__);	\
    } while (0)
#endif

	inline char* GetShaderLogInfo(GLuint shader) {
		GLint len;
		GLsizei actualLen;
		GL_C(glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &len));
		char* infoLog = new char[len];
		GL_C(glGetShaderInfoLog(shader, len, &actualLen, infoLog));
		return infoLog;
	}

	inline GLuint CreateShaderFromString(const std::string& shaderSource, const GLenum shaderType) {
		GLuint shader;

		GL_C(shader = glCreateShader(shaderType));
		const char *c_str = shaderSource.c_str();
		GL_C(glShaderSource(shader, 1, &c_str, NULL));
		GL_C(glCompileShader(shader));

		GLint compileStatus;
		GL_C(glGetShaderiv(shader, GL_COMPILE_STATUS, &compileStatus));
		if (compileStatus != GL_TRUE) {
			printf("Could not compile shader\n\n%s \n\n%s\n", shaderSource.c_str(),
				GetShaderLogInfo(shader));
			exit(1);
		}

		return shader;
	}


	inline GLuint LoadNormalShader(const std::string& vsSource, const std::string& fsShader) {
		GLuint vs = CreateShaderFromString(vsSource, GL_VERTEX_SHADER);
		GLuint fs = CreateShaderFromString(fsShader, GL_FRAGMENT_SHADER);

		GLuint shader = glCreateProgram();
		glAttachShader(shader, vs);
		glAttachShader(shader, fs);
		glLinkProgram(shader);

		GLint Result;
		glGetProgramiv(shader, GL_LINK_STATUS, &Result);
		if (Result == GL_FALSE) {
			printf("Could not link shader \n\n%s\n", GetShaderLogInfo(shader));
			exit(1);
		}

		glDetachShader(shader, vs);
		glDetachShader(shader, fs);

		glDeleteShader(vs);
		glDeleteShader(fs);

		return shader;
	}

	// first comes global variables:
	struct Mesh;
	std::vector<Mesh*> meshes; // all the meshes of the .obj model.


	struct Mesh {
		GLuint positionVbo;
		GLuint normalVbo;
		GLuint colorVbo;
		
		std::vector<float> positions;
		std::vector<float> normals;
		std::vector<float> colors;
		
		// upload mesh to GPU.
		void UploadMesh() {
			GL_C(glGenBuffers(1, &this->positionVbo));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, this->positionVbo));
			GL_C(glBufferData(GL_ARRAY_BUFFER, sizeof(GLfloat)*this->positions.size(), this->positions.data(), GL_STATIC_DRAW));

			GL_C(glGenBuffers(1, &this->normalVbo));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, this->normalVbo));
			GL_C(glBufferData(GL_ARRAY_BUFFER, sizeof(GLfloat)*this->normals.size(), this->normals.data(), GL_STATIC_DRAW));

			GL_C(glGenBuffers(1, &this->colorVbo));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, this->colorVbo));
			GL_C(glBufferData(GL_ARRAY_BUFFER, sizeof(GLfloat)*this->colors.size(), this->colors.data(), GL_STATIC_DRAW));
		}
	};

	class vec2 {
	public:
		double x, y;

		vec2(double x, double y) { this->x = x; this->y = y; }

		vec2(double v) { this->x = v; this->y = v; }

		vec2() { this->x = this->y = 0.0; }
	};

	class vec3 {
	public:
		double x, y, z;

		vec3(double x, double y, double z) { this->x = x; this->y = y; this->z = z; }

		vec3(double v) { this->x = v; this->y = v; this->z = v; }

		vec3() { this->x = this->y = this->z = 0; }

		vec3& operator+=(const vec3& b) { (*this) = (*this) + b; return (*this); }
		vec3& operator-=(const vec3& b) { (*this) = (*this) - b; return (*this); }

		friend vec3 operator-(const vec3& a, const vec3& b) { return vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
		friend vec3 operator+(const vec3& a, const vec3& b) { return vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
		friend vec3 operator*(const double s, const vec3& a) { return vec3(s * a.x, s * a.y, s * a.z); }
		friend vec3 operator*(const vec3& a, const double s) { return s * a; }

		static double length(const vec3& a) { return sqrt(vec3::dot(a, a)); }

		// dot product.
		static double dot(const vec3& a, const vec3& b) { return a.x*b.x + a.y*b.y + a.z*b.z; }

		static double distance(const vec3& a, const vec3& b) { return length(a - b); }
		static vec3 normalize(const vec3& a) { return (1.0f / vec3::length(a)) * a; }

		// cross product.
		static vec3 cross(const vec3& a, const vec3& b) { return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }

		//
		// Rotate the vector 'v' around the 'axis' for 'theta' degrees.
		// This is basically Rodrigues' rotation formula.
		//
		static vec3 rotate(const vec3& v, const double theta, const vec3& axis) {
			vec3 k = vec3::normalize(axis); // normalize for good measure.
			return v * cos(theta) + vec3::cross(k, v)* sin(theta) + (k * vec3::dot(k, v)) * (1.0f - cos(theta));
		}
	};

	class mat4 {
	public:
		float m[4][4];

		mat4() {
			for (int i = 0; i < 4; i++) {
				for (int j = 0; j < 4; j++) {
					m[i][j] = (i == j) ? 1.0f : 0.0f;
				}
			}
		}

		// return perspective projection matrix.
		static mat4 perspective(float fovy, float aspect, float zNear, float zFar) {

			const float tanHalfFovy = tan(fovy / 2.0f);
			const float tanHalfFovy3 = tan(0.78f / 2.0f);
			const float tanHalfFovy4 = tan(1.6f / 2.0f);
			const float tanHalfFovy5 = tan(50.0f / 2.0f);

			mat4 m;

			float ymax = zNear * tan(fovy * 3.14f / 360.0f);
			float xmax = ymax * aspect;

			float left = -xmax;
			float right = +xmax;

			float bottom = -ymax;
			float top = +ymax;


			float f1, f2, f3, f4;
			f1 = 2.0f * zNear;
			f2 = right - left;
			f3 = top - bottom;
			f4 = zFar - zNear;

			m.m[0][0] = f1 / f2;
			m.m[1][1] = f1 / f3;
			m.m[2][2] = (-zFar - zNear) / f4;

			m.m[2][0] = (right + left) / f2;
			m.m[2][1] = (top + bottom) / f3;

			m.m[2][3] = -1;
			m.m[3][2] = (-zFar * f1) / f4;

			m.m[3][3] = 0.0f;
			return m;

		}

		static mat4 lookAt(const vec3& eye, const vec3& center, const vec3& up)
		{
			mat4 m;
			// compute the basis vectors.
			vec3 forward = vec3::normalize(center - eye); // forward vector.
			vec3 left = vec3::normalize(vec3::cross(forward, up)); // left vector.
			vec3 u = vec3::cross(left, forward); // up vector.

			m.m[0][0] = left.x;
			m.m[1][0] = left.y;
			m.m[2][0] = left.z;
			m.m[0][1] = u.x;
			m.m[1][1] = u.y;
			m.m[2][1] = u.z;
			m.m[0][2] = -forward.x;
			m.m[1][2] = -forward.y;
			m.m[2][2] = -forward.z;
			m.m[3][0] = -vec3::dot(left, eye);
			m.m[3][1] = -vec3::dot(u, eye);
			m.m[3][2] = vec3::dot(forward, eye);

			return m;
		}

		friend mat4 operator*(const mat4& a, const mat4& b) {
			mat4 m;
			for (int i = 0; i < 4; i++) {
				for (int j = 0; j < 4; j++) {
					m.m[i][j] = 0.0f;
					for (int k = 0; k < 4; k++) {
						m.m[i][j] += a.m[i][k] * b.m[k][j];
					}
				}
			}
			return m;
		}

		friend vec3 operator*(const vec3& v, const mat4& m) {
			float res[4];
			res[0] = 0.0f;
			res[1] = 0.0f;
			res[2] = 0.0f;
			res[3] = 0.0f;

			res[0] += m.m[0][0] * v.x + m.m[1][0] * v.y + m.m[2][0] * v.z + m.m[3][0];

			res[1] += m.m[0][1] * v.x + m.m[1][1] * v.y + m.m[2][1] * v.z + m.m[3][1];

			res[2] += m.m[0][2] * v.x + m.m[1][2] * v.y + m.m[2][2] * v.z + m.m[3][2];

			res[3] += m.m[0][3] * v.x + m.m[1][3] * v.y + m.m[2][3] * v.z + m.m[3][3];

			return vec3(res[0] / res[3], res[1] / res[3], res[2] / res[3]);
		}

	};


	//
	//
	// begin Camera
	//
	//
	class Camera {
	private:

		vec3 viewDir;
		vec3 right;
		vec3 up;
		vec3 position;

		double prevMouseX = 0.0;
		double prevMouseY = 0.0;

		double curMouseX = 0.0;
		double curMouseY = 0.0;

	public:
		mat4 GetViewMatrix() {
			return mat4::lookAt(position, position + viewDir, up);
		}

		Camera(const vec3& position_, const vec3& viewDir_) : position(position_), viewDir(viewDir_) {
			viewDir = vec3::normalize(viewDir);
			right = vec3::normalize(vec3::cross(viewDir, vec3(0.0f, 1.0f, 0.0f)));
			up = vec3(0, 1.0f, 0);
		}

		void Update(const float delta, GLFWwindow* window) {
			// we use mouse movement to change the camera viewing angle.
			prevMouseX = curMouseX;
			prevMouseY = curMouseY;
			glfwGetCursorPos(window, &curMouseX, &curMouseY);
			float mouseDeltaX = (float)(curMouseX - prevMouseX);
			float mouseDeltaY = (float)(curMouseY - prevMouseY);

			if (glfwGetMouseButton(window, GLFW_MOUSE_BUTTON_LEFT) == GLFW_PRESS) {
				viewDir = vec3::normalize(vec3::rotate(viewDir, mouseDeltaX*-0.01f, up));
				viewDir = vec3::normalize(vec3::rotate(viewDir, mouseDeltaY*-0.01f, right));
				right = vec3::normalize(vec3::cross(viewDir, vec3(0.0f, 1.0f, 0.0f)));
				up = vec3(0.0f, 1.0f, 0.0f);
			}

			static float cameraSpeed;

			if (glfwGetKey(window, GLFW_KEY_M) == GLFW_PRESS)
				cameraSpeed = 0.1f;
			else
				cameraSpeed = 0.01f;

			if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
				position += delta * cameraSpeed * viewDir;
			else if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
				position += -delta * cameraSpeed * viewDir;

			if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
				position += -delta * cameraSpeed * right;
			else if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
				position += +delta * cameraSpeed * right;

			if (glfwGetKey(window, GLFW_KEY_O) == GLFW_PRESS)
				position += +delta * cameraSpeed * up;
			else if (glfwGetKey(window, GLFW_KEY_L) == GLFW_PRESS)
				position += -delta * cameraSpeed * up;

			if (glfwGetKey(window, GLFW_KEY_7) == GLFW_PRESS) {
				printf("vec3(%f,%f,%f), vec3(%f,%f,%f),\n\n",

					position.x, position.y, position.z,

					viewDir.x, viewDir.y, viewDir.z

				);
			}
		}

		vec3 GetPosition() const {
			return position;
		}
	};

	mat4 projectionMatrix;

	float zNear = 0.01f;
	float zFar = 1000.0;

	const int WINDOW_WIDTH = 1280;
	const int WINDOW_HEIGHT = 720;

	GLuint vao;

	GLFWwindow* window;
	int FRAME_RATE = 60;
	double totalTime = 0.0f; // global time.

	int fbWidth, fbHeight;

	GLuint shader;

	Camera camera(
		vec3(-0.159000, 0.224729, -1.221109), vec3(0.146948, -0.232104, 0.961527)
	);

	void InitGlfw() {
		if (!glfwInit())
			exit(EXIT_FAILURE);

		glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);
		glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
		glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
		glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
		glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);

		window = glfwCreateWindow(WINDOW_WIDTH, WINDOW_HEIGHT, "Laplacian deformation demo", NULL, NULL);
		if (!window) {
			glfwTerminate();
			exit(EXIT_FAILURE);
		}
		glfwMakeContextCurrent(window);

		// load GLAD.
		gladLoadGLLoader((GLADloadproc)glfwGetProcAddress);

		// Bind and create VAO, otherwise, we can't do anything in OpenGL.
		glGenVertexArrays(1, &vao);
		glBindVertexArray(vao);


		glfwGetFramebufferSize(window, &fbWidth, &fbHeight);
	}

	void renderMeshes() {
		// setup matrices.
		projectionMatrix = mat4::perspective(50.0f, (float)(WINDOW_WIDTH) / (float)WINDOW_HEIGHT, zNear, zFar);
		mat4 viewMatrix = camera.GetViewMatrix();
		mat4 VP = viewMatrix * projectionMatrix;

		GL_C(glUseProgram(shader)); // "output geometry to gbuffer" shader
		GL_C(glUniformMatrix4fv(glGetUniformLocation(shader, "uVp"), 1, GL_FALSE, (GLfloat *)VP.m));

		GL_C(glUniform3f(glGetUniformLocation(shader, "uEyePos"), (float)camera.GetPosition().x, (float)camera.GetPosition().y, (float)camera.GetPosition().z));

		int icount = 0;
		for (Mesh* mesh : meshes) {
			GL_C(glEnableVertexAttribArray(0));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, mesh->positionVbo));
			GL_C(glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 0, (void*)0));

			GL_C(glEnableVertexAttribArray(1));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, mesh->normalVbo));
			GL_C(glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 0, (void*)0));

			GL_C(glEnableVertexAttribArray(2));
			GL_C(glBindBuffer(GL_ARRAY_BUFFER, mesh->colorVbo));
			GL_C(glVertexAttribPointer(2, 3, GL_FLOAT, GL_FALSE, 0, (void*)0));

			glDrawArrays(GL_TRIANGLES, 0, (GLsizei)mesh->positions.size() / 3);
			icount++;
		}
	}

	void Render() {

		// setup GL state.
		GL_C(glEnable(GL_DEPTH_TEST));
		GL_C(glDepthMask(true));
		GL_C(glDisable(GL_BLEND));
		GL_C(glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE));
		GL_C(glEnable(GL_CULL_FACE));
		GL_C(glFrontFace(GL_CCW));
		GL_C(glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0));
		GL_C(glUseProgram(0));
		GL_C(glBindTexture(GL_TEXTURE_2D, 0));
		GL_C(glDepthFunc(GL_LESS));

		GL_C(glViewport(0, 0, fbWidth, fbHeight));
		GL_C(glClearColor(1.0f, 1.0f, 1.0f, 1.0f));
		GL_C(glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT));

		renderMeshes();
	}


	void HandleInput() {
		if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
			glfwSetWindowShouldClose(window, GLFW_TRUE);
		}

		camera.Update(1.0f / (float)FRAME_RATE, window);
	}

	unsigned int split(const std::string &txt, std::vector<std::string> &strs, char ch)
	{
		size_t pos = txt.find(ch);
		size_t initialPos = 0;
		strs.clear();


		// Decompose statement
		while (pos != std::string::npos) {
			strs.push_back(txt.substr(initialPos, pos - initialPos + 1));
			initialPos = pos + 1;

			pos = txt.find(ch, initialPos);
		}

		// Add the last one
		strs.push_back(txt.substr(initialPos, std::min(pos, txt.size()) - initialPos + 1));

		return (unsigned int)strs.size();
	}

	void calcNormals(
		const std::vector<vec3>& positions,
		const std::vector<int>& cells,

		std::vector<vec3>& normals

	) {
		normals.clear();
		for (int i = 0; i < positions.size(); ++i) {
			normals.push_back(vec3(0.0f, 0.0f, 0.0f));
		}

		for (int ic = 0; ic < cells.size(); ic += 3) {
			int c0 = cells[ic + 0];
			int c1 = cells[ic + 1];
			int c2 = cells[ic + 2];

			vec3 n = vec3::normalize(vec3::cross(
				positions[c1] - positions[c0],
				positions[c2] - positions[c0]));

			normals[c0] += n;
			normals[c1] += n;
			normals[c2] += n;
		}

		for (int i = 0; i < normals.size(); ++i) {
			normals[i] = vec3::normalize(normals[i]);
		}
	}

	void loadMesh(
		char* filename,
		std::vector<vec3>& positions,
		std::vector<vec3>& normals,

		std::vector<int>& cells
	) {
		FILE* file = fopen(filename, "r"); 

		if (file == NULL) {

			printf("could not open file %s\n", filename);
		}

		char line[256];
		bool startParse = false;
		while (fgets(line, sizeof(line), file)) {

			std::vector<std::string> strs;

			split(std::string(line), strs, ' ');

			if (startParse) {
				if (strs[0] == "3 ") {
					cells.push_back(std::stoi(strs[1]));
					cells.push_back(std::stoi(strs[2]));
					cells.push_back(std::stoi(strs[3]));
				}
				else {
					positions.push_back(vec3(std::stof(strs[0]), std::stof(strs[1]), std::stof(strs[2])));

				}
			}

			if (strs[0] == "end_header\n") {
				startParse = true;
			}
		}

		fclose(file);

		vec3 aabbMin(+1000, +1000, +1000);
		vec3 aabbMax(-1000, -1000, -1000);

		for (size_t j = 0; j < positions.size(); ++j) {
			vec3 p = positions[j];

			if (p.x < aabbMin.x) {
				aabbMin.x = p.x;
			}
			if (p.x > aabbMax.x) {
				aabbMax.x = p.x;
			}

			if (p.y < aabbMin.y) {
				aabbMin.y = p.y;
			}
			if (p.y > aabbMax.y) {
				aabbMax.y = p.y;
			}

			if (p.z < aabbMin.z) {
				aabbMin.z = p.z;
			}
			if (p.z > aabbMax.z) {
				aabbMax.z = p.z;
			}
		}

		// find longest side of AABB.
		int il = 0;

		double s = (aabbMax.x - aabbMin.x);

		if ((aabbMax.y - aabbMin.y) > s) {
			s = (aabbMax.y - aabbMin.y);
		}

		if ((aabbMax.z - aabbMin.z) > s) {
			s = (aabbMax.z - aabbMin.z);
		}

		s = 1.0f / s;

		/*
		Now that we have the AABB, we can use that info to the center the mesh,
		and scale it so that it fits in the unit cube.
		We do all those things for the purpose of normalizing the mesh, so
		that it is fully visible to the camera.
		*/
		vec3 t(
			-0.5f * (aabbMin.x + aabbMax.x),
			-0.5f * (aabbMin.y + aabbMax.y),
			-0.5f * (aabbMin.z + aabbMax.z));

		for (int j = 0; j < positions.size(); ++j) {

			vec3& p = positions[j];

			p.x += t.x;
			p.y += t.y;
			p.z += t.z;

			p.x *= s;
			p.y *= s;
			p.z *= s;


		}

		calcNormals(positions, cells, normals);
	}

	typedef std::vector<std::vector<int>> Adj;

	// get adjacancy list for vertices.
	Adj getAdj(int numVertices, const std::vector<int>& cells) {
		std::vector<std::vector<int>> adj;

		for (int i = 0; i < numVertices; ++i) {
			adj.push_back(std::vector<int>());
		}

		for (int i = 0; i < cells.size(); i += 3) {
			for (int j = 0; j < 3; ++j) {

				int a = cells[i + (j + 0)];
				int b = cells[i + ((j + 1) % 3)];

				adj[a].push_back(b);
			}
		}

		return adj;
	}


	void selectHandles(

		const int numVertices,
		const Adj& adj,

		const int mainHandle,
		const int handleRegionSize,
		const int unconstrainedRegionSize,

		std::vector<int>& handles,
		std::vector<int>& unconstrained,
		int& boundaryBegin)
	{
		std::vector<int> currentRing;
		currentRing.push_back(mainHandle);

		std::vector<bool> visited;
		for (int i = 0; i < numVertices; ++i) {
			visited.push_back(false);
		}

		std::vector<bool> unconstrainedSet;
		std::vector<bool> handlesSet;

		for (int i = 0; i < numVertices; ++i) {
			unconstrainedSet.push_back(false);
			handlesSet.push_back(false);
		}

		for (int k = 0; k < handleRegionSize; ++k) {

			std::vector<int> nextRing;

			for (int i = 0; i < currentRing.size(); ++i) {
				int e = currentRing[i];

				if (visited[e])
					continue;


				handles.push_back(e);
				visited[e] = true;
				handlesSet[e] = true;

				const std::vector<int>& adjs = adj[e];
				for (int j = 0; j < adjs.size(); ++j) {
					nextRing.push_back(adjs[j]);

				}
			}
			currentRing = nextRing;
		}
		
		for (int k = 0; k < unconstrainedRegionSize; ++k) {
			std::vector<int> nextRing;

			for (int i = 0; i < currentRing.size(); ++i) {
				int e = currentRing[i];

				if (visited[e])
					continue;

				unconstrained.push_back(e);
				visited[e] = true;
				unconstrainedSet[e] = true;

				const std::vector<int>& adjs = adj[e];
				for (int j = 0; j < adjs.size(); ++j) {
					nextRing.push_back(adjs[j]);
				}
			}
			currentRing = nextRing;
		}

		boundaryBegin = (int)handles.size();

		for (int i = 0; i < currentRing.size(); ++i) {
			int e = currentRing[i];

			if (visited[e])
				continue;

			handles.push_back(e);
			visited[e] = true;
		}
	}

	std::vector<double> flatten(const std::vector<vec3> arr) {

		std::vector<double> ret;

		for (int i = 0; i < arr.size(); ++i) {
			vec3 n = arr[i];
			ret.push_back(n.x);
			ret.push_back(n.y);
			ret.push_back(n.z);
		}

		return ret;
	}


	void deformMesh() {
		std::vector<vec3> meshPositions;
		std::vector<vec3> meshNormals;
		std::vector<vec3> meshColors;
		std::vector<int> meshCells; 
		Adj adj;// vertex adjacency info.

		loadMesh("../armadillo.ply", meshPositions, meshNormals, meshCells);
		adj = getAdj((int)meshPositions.size(), meshCells);

		std::vector<int> handles;
		std::vector<int> unconstrained;
		int boundaryBegin;

		selectHandles(

			(int)meshPositions.size(),
			adj,
			2096, 
			15, 
			35,
			handles,
			unconstrained,
			boundaryBegin);

		// choose vertex colors.
		{
			for (int i = 0; i < meshPositions.size(); ++i) {
				meshColors.push_back(vec3(0.0, 0.0, 0.0));
			}
			for (int i = 0; i < handles.size(); ++i) {
				vec3 c = vec3(0.0f, 0.0f, 0.0f);
				c = vec3(0.3f, 0.3f, 0.0f);
				meshColors[handles[i]] = c;
			}
			for (int i = 0; i < unconstrained.size(); ++i) {
				vec3 c = vec3(0.0f, 0.0f, 0.3f);
				meshColors[unconstrained[i]] = c;
			}
		}

		std::vector<int> combined;
		{
			// put all handles and unconstrained in one array, and send to solver. 
			for (int i = 0; i < handles.size(); ++i) {
				combined.push_back(handles[i]);
			}
			int unconstrainedBegin = handles.size();
			for (int i = 0; i < unconstrained.size(); ++i) {
				combined.push_back(unconstrained[i]);
			}

			prepareDeform(
				meshCells.data(), (int)meshCells.size(),
				(double *)meshPositions.data(), (int)meshPositions.size() * 3,
				combined.data(), (int)combined.size(),

				unconstrainedBegin,
				true);
		}

		double* arr = new double[(handles.size()) * 3];

		// move the handles. but the boundary vertices keep their old position.
		{
			int j = 0;
			for (int i = 0; i < (boundaryBegin); ++i) {
				arr[j * 3 + 0] = meshPositions[handles[i]].x + 0.0f;
				arr[j * 3 + 1] = meshPositions[handles[i]].y + 0.2f; // 0.4
				arr[j * 3 + 2] = meshPositions[handles[i]].z + 0.0f;

				++j;
			}

			for (int i = boundaryBegin; i < (handles.size()); ++i) {
				arr[j * 3 + 0] = meshPositions[handles[i]].x;
				arr[j * 3 + 1] = meshPositions[handles[i]].y;
				arr[j * 3 + 2] = meshPositions[handles[i]].z;

				++j;
			}
		}

		doDeform(arr, (int)handles.size(), (double *)meshPositions.data());

		// alright, the mesh has been deformed. now calculuate normals, and save the mesh
		{
			calcNormals(meshPositions, meshCells, meshNormals);


			Mesh* mesh = new Mesh();

			for (int ic = 0; ic < meshCells.size(); ic += 3) {
				for (int j = 0; j < 3; ++j) {

					mesh->positions.push_back(meshPositions[meshCells[ic + j]].x);
					mesh->positions.push_back(meshPositions[meshCells[ic + j]].y);
					mesh->positions.push_back(meshPositions[meshCells[ic + j]].z);

					mesh->normals.push_back(meshNormals[meshCells[ic + j]].x);
					mesh->normals.push_back(meshNormals[meshCells[ic + j]].y);
					mesh->normals.push_back(meshNormals[meshCells[ic + j]].z);

					mesh->colors.push_back(meshColors[meshCells[ic + j]].x);
					mesh->colors.push_back(meshColors[meshCells[ic + j]].y);
					mesh->colors.push_back(meshColors[meshCells[ic + j]].z);
				}
			}

			meshes.push_back(mesh);
		}
	}

	void runDemo() {
		InitGlfw();

		shader = LoadNormalShader(
			"#version 450\n"
			"layout(location = 0) in vec3 vsPos;"
			"layout(location = 1) in vec3 vsNormal;"
			"layout(location = 2) in vec3 vsColor;"
			
			"out vec3 fsPos;"
			"out vec3 fsNormal;"
			"out vec3 fsColor;"

			"uniform mat4 uVp;"
			"void main()"
			"{"
			"  fsPos = vsPos;"
			"  fsNormal = vsNormal;"
			"  fsColor = vsColor;"
			"  gl_Position = uVp * vec4(vsPos, 1.0);"
			"}",

			"#version 330\n"
			"in vec3 fsPos;"
			"in vec3 fsNormal;"

			"in vec3 fsColor;"

			"uniform vec3 uEyePos;"

			"void main()"
			"{"


			"vec3 color = fsColor + vec3(0.0, 0.0, 0.4);"

			"vec3 lp = uEyePos;"
			"vec3 l = normalize(lp - fsPos);"
			"vec3 v = normalize(uEyePos - fsPos);"
			"vec3 lc = vec3(1.0);"
			"gl_FragColor = vec4("
			"0.5*color +"
			"0.35*lc*clamp(dot(fsNormal, l), 0.0, 1.0)"
			"+ 0.15*lc*pow(clamp(dot(normalize(l + v), fsNormal), 0.0, 1.0), 8.0)"
			", 1.0);"

			"}"
		);

		deformMesh();  freeDeform();

		for (Mesh* mesh : meshes) {
			mesh->UploadMesh();
		}

		while (!glfwWindowShouldClose(window)) {
			float frameStartTime = (float)glfwGetTime();

			glfwPollEvents();
			Render();
			HandleInput();
			glfwSwapBuffers(window);

		}

		glfwTerminate();
		exit(EXIT_SUCCESS);
	}
}

int main(int argc, char** argv) {
	demo::runDemo();
}