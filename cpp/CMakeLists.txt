# CMake entry point
cmake_minimum_required (VERSION 3.1)
project (laplacian_deformation)

find_package(OpenGL REQUIRED)

# get rid of annoying MSVC warnings.
add_definitions(-D_CRT_SECURE_NO_WARNINGS)

# Compile external dependencies
add_subdirectory (deps)

set (CMAKE_CXX_STANDARD 11)

include_directories(
	deps/glfw-3.2/include/GLFW/
	deps/glad/include
	deps/tiny_obj_loader
	deps/lodepng
	deps/
    src/
    )

if(${CMAKE_SYSTEM_NAME} MATCHES "Linux")
set(OPENGL_LIBRARY
	${OPENGL_LIBRARY}
	-lGL -lGLU -lXrandr -lXext -lX11 -lrt
	${CMAKE_DL_LIBS}
	${GLFW_LIBRARIES}
)
elseif(${CMAKE_SYSTEM_NAME} MATCHES "Darwin")
set(OPENGL_LIBRARY
	${OPENGL_LIBRARY}
	${CMAKE_DL_LIBS}
	${GLFW_LIBRARIES}
)
endif(${CMAKE_SYSTEM_NAME} MATCHES "Linux")

set(ALL_LIBS
	${OPENGL_LIBRARY}
	glfw
)

add_executable(laplacian_deformation
  src/main.cpp
  src/laplacian_deformation.cpp
  deps/glad/src/glad.c)

target_link_libraries(laplacian_deformation
	${ALL_LIBS}
)
