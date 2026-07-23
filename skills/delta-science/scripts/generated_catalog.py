"""Generated Science catalog aliases. Do not edit by hand."""

LEGACY_TOOL_ALIASES = {
    "synbo": "synbo-service",
    "antbo": "antbo-service",
}

LEGACY_ENDPOINTS = {
    "pubchem": {
        "health": "chem_pubchem_health",
        "compound-resolve-cids": "chem_pubchem_compound_resolve-cids",
        "compound-properties": "chem_pubchem_compound_properties",
        "compound-synonyms": "chem_pubchem_compound_synonyms",
        "compound-summary": "chem_pubchem_compound_summary",
        "compound-batch-summary": "chem_pubchem_compound_batch-summary",
    },
    "rdkit": {
        "health": "chem_rdkit_health",
        "parse": "chem_rdkit_parse",
        "descriptors": "chem_rdkit_descriptors",
        "batch-descriptors": "chem_rdkit_batch-descriptors",
        "batch-parse-describe": "chem_rdkit_batch-parse-describe",
        "render": "chem_rdkit_render",
        "fingerprint": "chem_rdkit_fingerprint",
        "similarity": "chem_rdkit_similarity",
        "similarity-matrix": "chem_rdkit_similarity-matrix",
        "substructure": "chem_rdkit_substructure",
    },
    "pymatgen": {
        "health": "chem_pymatgen_health",
        "composition-parse": "chem_pymatgen_composition_parse",
        "structure-parse": "chem_pymatgen_structure_parse",
        "structure-summary": "chem_pymatgen_structure_summary",
        "structure-convert": "chem_pymatgen_structure_convert",
        "structure-symmetry": "chem_pymatgen_structure_symmetry",
    },
    "gsasii": {
        "health": "chem_gsasii_health",
        "powder-simulate": "chem_gsasii_powder_simulate",
        "powder-refine": "chem_gsasii_powder_refine",
    },
    "lammps": {
        "health": "chem_lammps_health",
        "lj-melt-example": "chem_lammps_examples_lj-melt",
        "run": "chem_lammps_run",
    },
    "delta-bo": {
        "commands": "chem_delta-bo_commands",
        "generate": "chem_delta-bo_generate",
    },
    "ldm-bo": {
        "health": "chem_ldm-bo_health",
        "recommend": "chem_ldm-bo_recommend",
        "trajectory": "chem_ldm-bo_trajectory",
    },
    "synbo": {
        "health": "chem_synbo_health",
        "initialize": "chem_synbo_initialize",
        "optimize": "chem_synbo_optimize",
    },
    "antbo": {
        "health": "biology_antbo_health",
        "run-default-job": "biology_antbo_run_default_job",
        "run": "biology_antbo_run",
        "log": "biology_antbo_log",
        "jobs": "biology_antbo_jobs",
        "stop": "biology_antbo_stop",
    },
}
