# Verifier image: the task environment with the grading files and the verifier runtime.
FROM maintkit.local/environment:base
ENTRYPOINT []
HEALTHCHECK NONE
USER root
RUN [ "$(uname -m)" = x86_64 ] || { echo "verifier error: the verifier runtime needs an x86_64 image."; exit 1; }; \
    if ls /lib/ld-musl-* >/dev/null 2>&1; then echo "verifier error: the verifier runtime needs a glibc image; this image is musl-based."; exit 1; fi
COPY --from=maintkit.local/judge:local /opt/judge /opt/judge
RUN /opt/judge/python/bin/python3 -I /opt/judge/judge.py --help >/dev/null && test -s /opt/judge/run_criteria.py
COPY . /tests/
RUN rm -f /tests/Dockerfile /tests/docker-compose.yaml && chmod +x /tests/test.sh \
    && /opt/judge/python/bin/python3 -I /opt/judge/run_criteria.py setup-image
