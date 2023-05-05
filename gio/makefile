# Makefile

# Change these variables to match your setup
NODE_INCLUDE_DIR = /usr/include/node
NAN_INCLUDE_DIR = /path/to/nan
GIO_LIBS = $(shell pkg-config --libs gio-2.0 glib-2.0)
GIO_CFLAGS = $(shell pkg-config --cflags gio-2.0 glib-2.0)

# Compiler flags
CXXFLAGS = -std=c++11 -Wall -Wextra -pedantic -fPIC -I$(NODE_INCLUDE_DIR) -I$(NAN_INCLUDE_DIR) $(GIO_CFLAGS)

# Linker flags
LDFLAGS = $(GIO_LIBS)

# List of source files
SRCS = src/cp_gio.cc

# List of object files
OBJS = $(SRCS:.cc=.o)

# Name of the addon
TARGET = gio

# Build rule for the addon
$(TARGET).node: $(OBJS)
	$(CXX) $(LDFLAGS) -shared -o $@ $^

# Build rule for object files
%.o: %.cc
	$(CXX) $(CXXFLAGS) -c -o $@ $<

# Clean rule
clean:
	rm -f $(OBJS) $(TARGET).node

.PHONY: clean