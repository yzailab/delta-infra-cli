# Science catalog（自动生成）

本文件由 `skills/science-tools.json` 生成；不要手工修改。规范名称供 CLI/Skill 使用，legacy 名称仅用于兼容已部署的 `/science_tool` catalog。

| 规范 tool | Skill | 类别 | operation | legacy endpoint |
| --- | --- | --- | --- | --- |
| pubchem | pubchem | molecule-information | health | chem_pubchem_health |
| pubchem | pubchem | molecule-information | compound-resolve-cids | chem_pubchem_compound_resolve-cids |
| pubchem | pubchem | molecule-information | compound-properties | chem_pubchem_compound_properties |
| pubchem | pubchem | molecule-information | compound-synonyms | chem_pubchem_compound_synonyms |
| pubchem | pubchem | molecule-information | compound-summary | chem_pubchem_compound_summary |
| pubchem | pubchem | molecule-information | compound-batch-summary | chem_pubchem_compound_batch-summary |
| rdkit | rdkit | cheminformatics | health | chem_rdkit_health |
| rdkit | rdkit | cheminformatics | parse | chem_rdkit_parse |
| rdkit | rdkit | cheminformatics | descriptors | chem_rdkit_descriptors |
| rdkit | rdkit | cheminformatics | batch-descriptors | chem_rdkit_batch-descriptors |
| rdkit | rdkit | cheminformatics | batch-parse-describe | chem_rdkit_batch-parse-describe |
| rdkit | rdkit | cheminformatics | render | chem_rdkit_render |
| rdkit | rdkit | cheminformatics | fingerprint | chem_rdkit_fingerprint |
| rdkit | rdkit | cheminformatics | similarity | chem_rdkit_similarity |
| rdkit | rdkit | cheminformatics | similarity-matrix | chem_rdkit_similarity-matrix |
| rdkit | rdkit | cheminformatics | substructure | chem_rdkit_substructure |
| pymatgen | pymatgen | materials-informatics | health | chem_pymatgen_health |
| pymatgen | pymatgen | materials-informatics | composition-parse | chem_pymatgen_composition_parse |
| pymatgen | pymatgen | materials-informatics | structure-parse | chem_pymatgen_structure_parse |
| pymatgen | pymatgen | materials-informatics | structure-summary | chem_pymatgen_structure_summary |
| pymatgen | pymatgen | materials-informatics | structure-convert | chem_pymatgen_structure_convert |
| pymatgen | pymatgen | materials-informatics | structure-symmetry | chem_pymatgen_structure_symmetry |
| gsasii | gsasii | diffraction | health | chem_gsasii_health |
| gsasii | gsasii | diffraction | powder-simulate | chem_gsasii_powder_simulate |
| gsasii | gsasii | diffraction | powder-refine | chem_gsasii_powder_refine |
| lammps | lammps | molecular-dynamics | health | chem_lammps_health |
| lammps | lammps | molecular-dynamics | lj-melt-example | chem_lammps_examples_lj-melt |
| lammps | lammps | molecular-dynamics | run | chem_lammps_run |
| delta-bo | delta-bo | optimization | commands | chem_delta-bo_commands |
| delta-bo | delta-bo | optimization | generate | chem_delta-bo_generate |
| ldm-bo | ldm-bo | molecule-optimization | health | chem_ldm-bo_health |
| ldm-bo | ldm-bo | molecule-optimization | recommend | chem_ldm-bo_recommend |
| ldm-bo | ldm-bo | molecule-optimization | trajectory | chem_ldm-bo_trajectory |
| synbo | synbo-service | reaction-optimization | health | chem_synbo_health |
| synbo | synbo-service | reaction-optimization | initialize | chem_synbo_initialize |
| synbo | synbo-service | reaction-optimization | optimize | chem_synbo_optimize |
| antbo | antbo-service | antibody-optimization | health | biology_antbo_health |
| antbo | antbo-service | antibody-optimization | run-default-job | biology_antbo_run_default_job |
| antbo | antbo-service | antibody-optimization | run | biology_antbo_run |
| antbo | antbo-service | antibody-optimization | log | biology_antbo_log |
| antbo | antbo-service | antibody-optimization | jobs | biology_antbo_jobs |
| antbo | antbo-service | antibody-optimization | stop | biology_antbo_stop |
