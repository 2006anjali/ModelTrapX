// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReportRegistry
/// @notice Stores SHA-256 hashes of ModelTrap X evaluation reports.
/// It proves a report hash was recorded at a certain time by a certain
/// address. It does not prove the evaluation itself was correct.
contract ReportRegistry {
    struct Record {
        address submitter;
        uint64 timestamp;
        string testSuite;
        string metadata;
    }

    mapping(bytes32 => Record) private records;
    mapping(bytes32 => bool) private registered;

    event ReportRegistered(bytes32 indexed reportHash, address indexed submitter);

    function registerReport(
        bytes32 reportHash,
        string calldata testSuite,
        string calldata metadata
    ) external {
        require(reportHash != bytes32(0), "Empty hash");
        require(!registered[reportHash], "Report already registered");

        registered[reportHash] = true;
        records[reportHash] = Record(
            msg.sender,
            uint64(block.timestamp),
            testSuite,
            metadata
        );

        emit ReportRegistered(reportHash, msg.sender);
    }

    function isRegistered(bytes32 reportHash) external view returns (bool) {
        return registered[reportHash];
    }

    function getReport(bytes32 reportHash)
        external
        view
        returns (
            address submitter,
            uint64 timestamp,
            string memory testSuite,
            string memory metadata
        )
    {
        require(registered[reportHash], "Report not found");
        Record storage r = records[reportHash];
        return (r.submitter, r.timestamp, r.testSuite, r.metadata);
    }
}
