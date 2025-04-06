@tool
class_name MCPProjectCommands
extends MCPBaseCommandProcessor

func process_command(client_id: int, command_type: String, params: Dictionary, command_id: String) -> bool:
	match command_type:
		"read_file":
			_read_file(client_id, params, command_id)
			return true
		"write_file":
			_write_file(client_id, params, command_id)
			return true
	return false  # Command not handled

func _read_file(client_id: int, params: Dictionary, command_id: String) -> void:
    var identifier = params.get("identifier", "")
    
    # Validation
    if identifier.is_empty():
        return _send_error(client_id, "Identifier cannot be empty", command_id)
    
    # Convert user:// path to actual filesystem path
    var absolute_path = ProjectSettings.globalize_path(identifier)
    
    # Check if file exists
    if not FileAccess.file_exists(absolute_path):
        return _send_error(client_id, "File not found: " + absolute_path, command_id)
    
    # Read the file
    var file = FileAccess.open(absolute_path, FileAccess.READ)
    if not file:
        return _send_error(client_id, "Failed to open file: " + absolute_path, command_id)
    
    var content = file.get_as_text()
    var file_size = file.get_length()
    file = null  # Close the file
    
    _send_success(client_id, {
        "identifier": identifier,
        "content": content,
        "file_size": file_size
    }, command_id)

func _write_file(client_id: int, params: Dictionary, command_id: String) -> void:
    var identifier = params.get("identifier", "")
    var content = params.get("content", "")
    
    # Validation
    if identifier.is_empty():
        return _send_error(client_id, "Identifier cannot be empty", command_id)
    
    # Convert path to actual filesystem path
    var absolute_path = ProjectSettings.globalize_path(identifier)
    
    # Create directory if it doesn't exist
    var dir = DirAccess.open(absolute_path.get_base_dir())
    if not dir:
        var error = DirAccess.make_dir_recursive_absolute(absolute_path.get_base_dir())
        if error != OK:
            return _send_error(client_id, "Failed to create directory: " + absolute_path.get_base_dir(), command_id)
    
    # Write to the file
    var file = FileAccess.open(absolute_path, FileAccess.WRITE)
    if not file:
        var error = FileAccess.get_open_error()
        return _send_error(client_id, "Failed to open file for writing: " + absolute_path + " (Error: " + str(error) + ")", command_id)
    
    file.store_string(content)
    file = null  # Close the file
    
    _send_success(client_id, {
        "identifier": identifier,
        "success": true
    }, command_id)

func _list_files(client_id: int, params: Dictionary, command_id: String) -> void:
    var directory = params.get("directory", "")
    var extensions = params.get("extensions", [])
    var recursive = params.get("recursive", true)
    
    # Validation
    if directory.is_empty():
        return _send_error(client_id, "Directory path cannot be empty", command_id)
    
    # Convert path to actual filesystem path if needed
    var dir_path = directory
    if not dir_path.ends_with("/"):
        dir_path += "/"
    
    # Open the directory
    var dir = DirAccess.open(dir_path)
    if not dir:
        return _send_error(client_id, "Failed to open directory: " + dir_path, command_id)
    
    # Collect all files
    var files = []
    _collect_files(dir, dir_path, files, extensions, recursive)
    
    _send_success(client_id, {
        "directory": directory,
        "files": files
    }, command_id)

# not api
func _collect_files(dir: DirAccess, current_path: String, files: Array, extensions: Array, recursive: bool) -> void:
    dir.list_dir_begin()
    var file_name = dir.get_next()
    
    while file_name != "":
        var full_path = current_path + file_name
        
        if dir.current_is_dir():
            if recursive:
                var subdir = DirAccess.open(full_path)
                if subdir:
                    _collect_files(subdir, full_path + "/", files, extensions, recursive)
        else:
            # Check if we need to filter by extension
            var add_file = true
            if not extensions.is_empty():
                add_file = false
                for ext in extensions:
                    if file_name.ends_with(ext):
                        add_file = true
                        break
            
            if add_file:
                files.append(full_path)
        
        file_name = dir.get_next()
    
    dir.list_dir_end()