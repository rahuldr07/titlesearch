"""What this service treats as sensitive, on top of the shared pipeline.

The pipeline itself — configuration, processors, the redaction step that runs
last before the renderer — is `titlepipe_service_kit.telemetry`. What is left
here is the part that is genuinely Blind's own: the extra key fragments in
`sensitivity.py` that this service redacts and Core does not.
"""
