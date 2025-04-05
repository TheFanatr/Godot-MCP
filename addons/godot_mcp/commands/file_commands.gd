extends "res://addons/godot_mcp/commands/base_command_processor.gd"

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