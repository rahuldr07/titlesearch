"""model -> DTO. The ONLY place both are imported.

`CONVENTIONS.md` §10 puts this package here for one reason, and it is not
symmetry with some other codebase's layer diagram. The model-to-DTO step is
where this application can silently LIE:

* a citation is whole or it is not one — a `source_doc_id` without a
  `source_page` must not be CONSTRUCTIBLE;
* `NOT_PRESENT` and `PRESENT_UNREADABLE` are two states and are never collapsed;
* `state` is READ from the server, never derived from `value is None`.

Those are DECISIONS. A field copy that happens to be spelled the same way in
both objects is not one, and the moment the two spellings drift the copy starts
answering a question nobody asked. One chokepoint means each decision is made
once, in a file whose name says that is what it is for.

`rules.py` is the first of them and has none of those three problems — the
rulebook is nine flat scalars. It is written out field by field anyway, because
the property that makes the rest of this package worth having is that a reader
can see the whole mapping without knowing which attributes happen to match.

WHAT MAKES THIS STRUCTURAL RATHER THAN A CONVENTION: the response models carry
no `from_attributes`. `RuleResponse.model_validate(some_row)` does not work from
anywhere, in a router or in a test, because Pydantic will not read attributes
off an arbitrary object without being told it may. The gate rule that says a
router may not construct a DTO from a model is the second line of defence; this
is the first, and it is the one that cannot be exempted with a comment.

Nothing is re-exported here. A caller names the module it wants.
"""
