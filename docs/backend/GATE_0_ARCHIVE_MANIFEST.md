# Gate 0 — recovered prototype: integrity manifest

SHA-256, size in bytes, and path relative to the archive root, for every file
in the frozen safety net.

**Archive location (outside the working tree, outside VCS):**

    %LOCALAPPDATA%\TitlePipe\gate0-prototype-archive\

The archive holds the extracted source *and* the two original `.zip` files
byte-for-byte, so the extraction can be redone and checked against these hashes.

## Why this file exists and the source does not

The recovered source contains no county packages, PDFs or seed database — that
was verified at recovery. But its **tests embed real party names and one street
address** taken from real county packages, so committing it is an owner
decision that has not been made (`GATE_0_RECOVERY.md` §4).

This manifest is the part that can be committed safely: it contains filenames
and hashes only, no content. It makes the archive verifiable — anyone can
confirm the safety net has not drifted or been tampered with — without putting
client-derived names into VCS.

## Verifying

```bash
python scripts/gate0/verify_archive.py
```

It checks the file **set** as well as every hash and size, and treats an
unexpected file as a failure.

That distinction is not pedantry: the archive had accumulated 31 `__pycache__`
and pytest-cache files from a test run while every listed hash still matched, so
a hash-only check reported success on an archive that was no longer the artefact
that had been frozen. The caches have been removed and the set is now exact.

## Manifest

```text
841e7f14c41e422cbc6f8b2c0340a57b861aa10cfc3777a58b1ad54c6cd2ba3d     10281  bugfixes/fix_api.py
7797e4a7d9a7f13eb287266a11107fc9ec2300b6ee1eeb048d6ddbd2b66f01cc     11652  bugfixes/fix_assemble.py
04dad1d23139eb1bcd21f293dcd4a9450a00bea8abf68dfb5fa6929eccf82452      4151  bugfixes/fix_segment.py
481921beb5c60d0d8799b6c8d2be934c66e952e1967eaded54e62ef5a5d1fea2      8510  titlepipe_bugfixes.zip
48d034fb388dc6e8fc2f4aad857cec7ca0e465922ee38741ceb65976b049f64d    113614  titlepipe.zip
7bb39cd80974db6a0b70f3ead834cb1d58c3fbcfdd574af3c234c939cc78d768       136  titlepipe/.gitignore
76615414d585eb71f4d4a8caaffdac049d5b021892827edb8eaae19cceb18a03      4074  titlepipe/CLAUDE.md
73cecf952cc45dbdfada49bf1e7363291f62f52801ed1f6e71019919222fd2cb     54315  titlepipe/docs/spec.md
49a7c9063216d77cfab2fd305511e735fdc06adc4f80c7f7563c0b7f35b4aa3d      1991  titlepipe/README.md
3da4464368ff3d4192b5c2d193f9f00065662361c56e66341b6db20b188c42d0      1001  titlepipe/runtests.py
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855         0  titlepipe/tests/__init__.py
f597da7a872c4ee97f190436b02e6ddc81e6b51e805096ffde2b9bcabb594602      5535  titlepipe/tests/test_api.py
2962fca3ec13f569c9b25647335dd65392eb1ad651c961fd921fc2323a9b9403     15655  titlepipe/tests/test_assemble.py
9ba0c1a0f387afa4744b7bd9622d14c50488eed8c43fd678d175abff1a1e7b42      6471  titlepipe/tests/test_day1.py
b5a03e35c288afed5835269e90e9cb9db085555ca5ffb20ebcd93331b6e0ed3c      9073  titlepipe/tests/test_golden.py
3ba931f3f8af50611d2905a6456eac852cd845b5692844cf90458cea4b514037     15103  titlepipe/tests/test_inbox.py
17e4c51c5e2bf7384d7568ec380587186dc141a2b1933ed5aa61c52b050a8b92      5519  titlepipe/tests/test_ingest.py
aa833cc24e0471479dc4a6a84d2cd550bd2c19f66d7f10005795ac1e50e1487e      7695  titlepipe/tests/test_render.py
b2959c8952d5267c207088eee546e2d1bea338ab1a9e72a0c5f9afb2db73117e      3622  titlepipe/tests/test_seed.py
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855         0  titlepipe/titlepipe/__init__.py
0ba41bec13cc46d6d49368d448597eb80622a40c7959d0fcbeb162a4b8a1d89e     19458  titlepipe/titlepipe/api.py
c5c475076eecb4ba834d8258edb951b68486602da9e7944b28555f2e65bd9796     17397  titlepipe/titlepipe/assemble.py
aadc41755a5796f0395337237cfb0e2e875616f86ac8b08092e6320114da61cb     16841  titlepipe/titlepipe/golden.py
33fb2db2878cf1cd0e22aefd610b6c18c948c10f95bf54b33b0b1d0bb916d98e     13434  titlepipe/titlepipe/inbox.py
2f5ca5b3014bcb3a9c9b680508a404c6f6b56a910d92d347f186253c9716f352      5507  titlepipe/titlepipe/ingest.py
baa994a19d66fe6ba10dedb3d7a09653b9ab6d053926a61e189280a0c7ed70bc     10793  titlepipe/titlepipe/models.py
b6b05b69f20e6b6a59da12f8a8c2110f95cb277b770dea4a0bd61a61913c2c9d     16397  titlepipe/titlepipe/render.py
6f434d42bb4ea28e9a2bddcb868a3caef14e6403ce26a97f8b05a4bb69a21913     11647  titlepipe/titlepipe/seed.py
0e201c4b4a9e3dc3bb4d84964285588b820aa7548c0ca4bfe270fbe79d7724e4     14090  titlepipe/titlepipe/segment.py
6150086122c8d489c4188d577f4bed0ed56f97f3f33d219074093834c6d4500d      5215  titlepipe/titlepipe/ui/index.html
c17ea2326edbf543365e1b02f201f941a92ce232e810fa9d9fd595af2325412e      6826  titlepipe/titlepipe/ui/upload.html
706c49b401346a96b5266885dd48289a69326f99a28f1c4171b320c5893026b2      9080  titlepipe/titlepipe/validators.py
249550bc283cb21a9f11333ca7c47ad967f353303a6718ae9ad4b638ee78a2c0     15960  titlepipe/tools/seed_golden.py
```

33 files, 441,043 bytes.
